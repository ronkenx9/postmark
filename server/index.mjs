import http from "node:http";
import { resolve, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createReadStream, existsSync, statSync } from "node:fs";
import { Chain } from "./chain.mjs";
const chain = process.env.POSTMARK_CHAIN === "devnet" ? new Chain() : null;
let mutationTail = Promise.resolve();
const dist = resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const buckets = new Map();
function staticFile(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end();
    return;
  }
  let path;
  try {
    path = decodeURIComponent(new URL(req.url, "http://local").pathname);
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  let file = resolve(dist, "." + path);
  if (!file.startsWith(dist + sep) && file !== dist) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (!existsSync(file) || !statSync(file).isFile())
    file = resolve(dist, "index.html");
  if (!existsSync(file)) {
    res.writeHead(503);
    res.end("Build the frontend first.");
    return;
  }
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".json": "application/json",
    ".woff2": "font/woff2",
    ".png": "image/png",
    ".jpg": "image/jpeg",
  };
  res.setHeader(
    "Content-Type",
    mime[extname(file)] || "application/octet-stream",
  );
  res.setHeader(
    "Cache-Control",
    extname(file) === ".html" ? "no-cache" : "public, max-age=3600",
  );
  if (req.method === "HEAD") res.end();
  else createReadStream(file).pipe(res);
}
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { createRoom, joinRoom, guess, nextRound, publicRoom } from "./game.mjs";
const dir = new URL(
  "file://" +
    resolve(
      process.env.POSTMARK_DATA_DIR ||
        fileURLToPath(new URL("../.data/", import.meta.url)),
    ) +
    "/",
);
mkdirSync(dir, { recursive: true });
const file = new URL("state.json", dir);
let db = { profiles: {}, rooms: {} };
try {
  db = JSON.parse(readFileSync(file, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const save = () => {
  writeFileSync(new URL("state.tmp", dir), JSON.stringify(db), { mode: 0o600 });
  renameSync(new URL("state.tmp", dir), file);
};
function award(room) {
  if (room.phase !== "finished") return;
  for (const id of room.players) {
    const p = db.profiles[id];
    if (!p || id === "guide") continue;
    for (const r of room.results) {
      const existing = p.stamps.find((s) => s.id === r.location.id);
      if (!existing)
        p.stamps.push({
          ...r.location,
          earnedAt: Date.now(),
          room: room.code,
          practice: room.practice,
        });
      else if (existing.practice && !room.practice) {
        existing.practice = false;
        existing.room = room.code;
        existing.duelEarnedAt = Date.now();
      }
    }
    if (!p.matches.includes(room.code)) p.matches.push(room.code);
  }
}
function guideGuess(room) {
  if (!room.practice || room.phase !== "guessing" || room.guesses.guide) return;
  const target = room.deck[room.round];
  guess(room, "guide", {
    lat: Math.max(-85, Math.min(85, target.lat + 7)),
    lng: ((target.lng + 12 + 180) % 360) - 180,
  });
}
const server = http.createServer(async (req, res) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!req.url.startsWith("/api/")) {
    staticFile(req, res);
    return;
  }
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  let release = () => {};
  try {
    if (req.method === "GET" && req.url === "/api/health") {
      res.end(
        JSON.stringify({
          ok: true,
          chain: chain ? "magicblock-devnet" : "local",
          chainConfigured: !!chain,
        }),
      );
      return;
    }
    let text = "";
    for await (const chunk of req) {
      text += chunk;
      if (text.length > 4096) {
        res.writeHead(413);
        res.end(JSON.stringify({ error: "Request too large." }));
        return;
      }
    }
    const body = text ? JSON.parse(text) : {};
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error("Invalid request.");
    const address = req.socket.remoteAddress;
    const now = Date.now();
    let bucket = buckets.get(address);
    if (!bucket || now - bucket.start > 60000) {
      bucket = { start: now, count: 0 };
      buckets.set(address, bucket);
    }
    if (++bucket.count > 600) {
      res.writeHead(429);
      res.end(
        JSON.stringify({ error: "Too many requests. Please wait a minute." }),
      );
      return;
    }
    if (buckets.size > 1000)
      for (const [k, v] of buckets)
        if (now - v.start > 60000) buckets.delete(k);
    const prior = mutationTail;
    mutationTail = new Promise((resolve) => {
      release = resolve;
    });
    await prior;
    const token = req.headers.authorization?.replace(/^Bearer /, "");
    let id = Object.keys(db.profiles).find(
      (k) => db.profiles[k].token === token && token,
    );
    if (req.method === "POST" && req.url === "/api/session") {
      const name =
        typeof body.name === "string" ? body.name.trim().slice(0, 24) : "";
      if (!name) throw new Error("Add your traveller name.");
      if (!id) {
        id = randomBytes(12).toString("hex");
        db.profiles[id] = {
          id,
          token: randomBytes(32).toString("hex"),
          name,
          stamps: [],
          matches: [],
        };
      } else db.profiles[id].name = name;
      save();
      res.end(JSON.stringify(db.profiles[id]));
      return;
    }
    if (!id) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "Start with your traveller name." }));
      return;
    }
    if (req.method === "GET" && req.url === "/api/me") {
      const { token: _, ...profile } = db.profiles[id];
      res.end(JSON.stringify(profile));
      return;
    }
    if (req.method === "POST" && req.url === "/api/rooms") {
      const room = createRoom(id, body.practice === true);
      while (db.rooms[room.code])
        room.code = randomBytes(3).toString("hex").toUpperCase();
      if (chain && !room.practice)
        room.chain = await chain.initialize(room.code);
      db.rooms[room.code] = room;
      if (room.practice) {
        joinRoom(room, "guide");
        guideGuess(room);
      }
      save();
      res.end(
        JSON.stringify(
          publicRoom(room, id, {
            ...db.profiles,
            guide: { name: "Postmark guide" },
          }),
        ),
      );
      return;
    }
    const match = req.url.match(
      /^\/api\/rooms\/([A-Z0-9]{6})(?:\/(join|guess|next))?$/,
    );
    if (!match) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found." }));
      return;
    }
    const room = db.rooms[match[1]];
    if (!room) throw new Error("Room not found. Check the six-character code.");
    if (req.method === "POST" && match[2] === "join") joinRoom(room, id);
    if (!room.players.includes(id)) {
      res.writeHead(403);
      res.end(JSON.stringify({ error: "Join the room first." }));
      return;
    }
    if (req.method === "POST" && match[2] === "guess") {
      if (body.round !== room.round)
        throw new Error(
          "This guess belongs to a different round. Refresh your match.",
        );
      const draft = structuredClone(room);
      guess(draft, id, body);
      if (chain && room.chain.verified) {
        const pendingKey = room.round + ":" + id;
        room.pendingGuesses ??= {};
        const old = room.pendingGuesses[pendingKey];
        if (old && (old.lat !== body.lat || old.lng !== body.lng))
          throw new Error(
            "Your original guess is pending on-chain. Retry those coordinates.",
          );
        room.pendingGuesses[pendingKey] = { lat: body.lat, lng: body.lng };
        draft.pendingGuesses = room.pendingGuesses;
        save();
        const locked = await chain.lock(
          room.code,
          room.round,
          room.players.indexOf(id),
          body,
        );
        draft.chain.transactions.push(locked);
        if (draft.results.length > room.results.length) {
          const entries = draft.results.at(-1).entries;
          draft.chain.transactions.push({
            signature: await chain.settle(
              room.code,
              room.round,
              entries.map((e) => e.score),
            ),
          });
        }
        if (draft.phase === "finished")
          draft.chain.result = await chain.finish(room.code);
      }
      Object.assign(room, draft);
      award(room);
    }
    if (req.method === "POST" && match[2] === "next") {
      nextRound(room, id);
      if (room.practice && room.phase === "reveal") nextRound(room, "guide");
      guideGuess(room);
    }
    if (req.method !== "GET" && req.method !== "POST")
      throw new Error("Method not supported.");
    if (req.method === "POST") save();
    res.end(
      JSON.stringify(
        publicRoom(room, id, {
          ...db.profiles,
          guide: { name: "Postmark guide" },
        }),
      ),
    );
  } catch (e) {
    res.writeHead(400);
    res.end(
      JSON.stringify({
        error: e instanceof SyntaxError ? "Invalid request." : e.message,
      }),
    );
  } finally {
    release();
  }
});
server.requestTimeout = 10000;
server.headersTimeout = 10000;
server.listen(
  Number(process.env.PORT || 4327),
  process.env.HOST || "127.0.0.1",
  () => console.log("Postmark game server ready"),
);
