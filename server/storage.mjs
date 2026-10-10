import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const empty = () => ({ profiles: {}, rooms: {} });
const connectionString = process.env.DATABASE_URL;
const pool = connectionString
  ? new pg.Pool({
      connectionString,
      max: 3,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000,
    })
  : null;
let ready;
let localTail = Promise.resolve();
export const storageMode = pool ? "postgres" : "file";
export async function beginStorage(write) {
  if (pool) {
    ready ??= pool
      .query(
        "CREATE TABLE IF NOT EXISTS postmark_state (id integer PRIMARY KEY CHECK(id=1), body jsonb NOT NULL)",
      )
      .then(() =>
        pool.query(
          "INSERT INTO postmark_state(id,body) VALUES(1,$1) ON CONFLICT DO NOTHING",
          [empty()],
        ),
      )
      .catch((e) => {
        ready = null;
        throw e;
      });
    await ready;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout = '10s'");
      const { rows } = await client.query(
        "SELECT body FROM postmark_state WHERE id=1" +
          (write ? " FOR UPDATE" : ""),
      );
      const db = rows[0].body;
      return {
        db,
        save: async () => {
          if (!write) throw new Error("Read-only transaction");
          await client.query("UPDATE postmark_state SET body=$1 WHERE id=1", [
            db,
          ]);
        },
        close: async (success) => {
          try {
            await client.query(success ? "COMMIT" : "ROLLBACK");
          } finally {
            client.release();
          }
        },
      };
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
      throw e;
    }
  }
  if (process.env.VERCEL)
    throw new Error("Persistent database is not configured.");
  let release;
  const prior = localTail;
  localTail = new Promise((r) => {
    release = r;
  });
  await prior;
  try {
    const dir = resolve(
      process.env.POSTMARK_DATA_DIR ||
        new URL("../.data/", import.meta.url).pathname,
    );
    mkdirSync(dir, { recursive: true });
    const file = resolve(dir, "state.json");
    let db;
    try {
      db = JSON.parse(readFileSync(file, "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      db = empty();
    }
    return {
      db,
      save: async () => {
        writeFileSync(resolve(dir, "state.tmp"), JSON.stringify(db), {
          mode: 0o600,
        });
        renameSync(resolve(dir, "state.tmp"), file);
      },
      close: async () => release(),
    };
  } catch (e) {
    release();
    throw e;
  }
}
