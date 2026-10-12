// Mirrors each real match onto a MagicBlock Ephemeral Rollup, outside the game
// lock. Gameplay stays authoritative in storage; this catches the chain up to
// it. Every step is derived from chain state, so repeated or racing syncs only
// send what is missing (the program also rejects duplicates).
import pg from "pg";

const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  : null;
const memory = new Map();
const running = new Set();
let ready;

async function table() {
  ready ??= pool
    .query(
      "CREATE TABLE IF NOT EXISTS postmark_chain (code text PRIMARY KEY, body jsonb NOT NULL)",
    )
    .catch((e) => {
      ready = null;
      throw e;
    });
  return ready;
}

export async function readMirror(code) {
  if (!pool) return memory.get(code) || null;
  await table();
  const { rows } = await pool.query(
    "SELECT body FROM postmark_chain WHERE code=$1",
    [code],
  );
  return rows[0]?.body || null;
}

// Atomic merge: fields are merged and log entries appended in SQL, so two
// overlapping syncs can never overwrite each other's records.
async function writeMirror(code, patch, tx) {
  if (!pool) {
    const m = memory.get(code) || { code, txs: [] };
    Object.assign(m, patch);
    if (tx && !m.txs.some((t) => t.signature === tx.signature)) m.txs.push(tx);
    return memory.set(code, m);
  }
  await table();
  await pool.query(
    `INSERT INTO postmark_chain(code,body) VALUES($1, $2::jsonb || jsonb_build_object('code',$1::text,'txs',$3::jsonb))
     ON CONFLICT (code) DO UPDATE SET body = postmark_chain.body || $2::jsonb ||
       jsonb_build_object('txs', COALESCE(postmark_chain.body->'txs','[]'::jsonb) ||
         CASE WHEN $3::jsonb = '[]'::jsonb OR COALESCE(postmark_chain.body->'txs','[]'::jsonb) @> $3::jsonb
              THEN '[]'::jsonb ELSE $3::jsonb END)`,
    [code, JSON.stringify(patch || {}), JSON.stringify(tx ? [tx] : [])],
  );
}

// One sync per room at a time across serverless instances.
async function withRoomLock(code, fn) {
  if (!pool) {
    if (running.has(code)) return false;
    running.add(code);
    try {
      await fn();
    } finally {
      running.delete(code);
    }
    return true;
  }
  // Dedicated connection: the lock must not hold a pooled client the sync itself needs.
  const client = new pg.Client({
    connectionString:
      process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  });
  await client.connect();
  try {
    const { rows } = await client.query(
      "SELECT pg_try_advisory_lock(hashtext($1)) AS ok",
      ["postmark:" + code],
    );
    if (!rows[0].ok) return false;
    try {
      await fn();
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [
        "postmark:" + code,
      ]);
    }
    return true;
  } finally {
    await client.end().catch(() => {});
  }
}

// Guesses for round r, by player index, from the stored game.
function guessesFor(room, r) {
  if (r < room.results.length)
    return room.players.map((p) => {
      const e = room.results[r].entries.find((x) => x.player === p);
      return e ? { lat: e.lat, lng: e.lng } : null;
    });
  if (r === room.round) return room.players.map((p) => room.guesses[p] || null);
  return [null, null];
}

export function behind(room, mirror) {
  if (!room || room.practice || room.players.length < 2) return false;
  if (!mirror?.address) return true;
  if (mirror.finished)
    return !(mirror.txs || []).some((t) => t.step === "settled");
  const locks = room.results.length * 2 + Object.keys(room.guesses).length;
  const done = (mirror.txs || []).filter((t) => t.step === "lock").length;
  const settles = (mirror.txs || []).filter((t) => t.step === "settle").length;
  return (
    done < locks ||
    settles < room.results.length ||
    (room.phase === "finished" && !mirror.finished)
  );
}

export async function syncRoom(chain, loadRoom, code) {
  return withRoomLock(code, async () => {
    for (let pass = 0; pass < 4; pass++) {
      const room = await loadRoom(code);
      if (!room || room.practice || room.players.length < 2) return;
      const m = (await readMirror(code)) || { code, txs: [] };
      const log = async (step, layer, signature, extra = {}, patch = {}) =>
        writeMirror(
          code,
          { ...patch, updatedAt: Date.now() },
          signature
            ? { step, layer, signature, at: Date.now(), ...extra }
            : null,
        );
      let progressed = false;
      if (!m.address) {
        const init = await chain.initialize(code);
        m.address = init.address;
        await log("create", "solana", init.initialize, {}, {
          address: init.address,
          validator: init.validator,
        });
        await log("delegate", "solana", init.delegate);
        progressed = true;
      }
      if (m.finished && (m.txs || []).some((t) => t.step === "settled")) return;
      let state = m.finished ? { round: 3 } : null;
      if (!m.finished) state = await chain.state(code);
      while (state.round < 3) {
        const r = state.round;
        const g = guessesFor(room, r);
        for (let i = 0; i < 2; i++) {
          if (!g[i] || state.locked & (1 << i)) continue;
          const out = await chain.lock(code, r, i, g[i]);
          await log("lock", "er", out.signature, { round: r, player: i });
          progressed = true;
        }
        state = await chain.state(code);
        if (r >= room.results.length || state.locked !== 3) break;
        const scores = room.players.map(
          (p) => room.results[r].entries.find((e) => e.player === p).score,
        );
        await log("settle", "er", await chain.settle(code, r, scores), {
          round: r,
        });
        progressed = true;
        state = await chain.state(code);
      }
      if (state.round === 3 && room.phase === "finished" && !m.finished) {
        const done = await chain.finish(code);
        m.finished = true;
        await log("commit", "er", done.signature, {}, {
          finished: true,
          final: { scores: done.state.scores },
        });
        progressed = true;
      }
      if (m.finished && !(m.txs || []).some((t) => t.step === "settled")) {
        for (let i = 0; i < 8; i++) {
          const sig = await chain.settlement(code).catch(() => null);
          if (sig) {
            await log("settled", "solana", sig);
            break;
          }
          await new Promise((r) => setTimeout(r, 2500));
        }
      }
      if (!progressed) return;
    }
  });
}
