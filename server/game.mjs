import { randomBytes, randomInt } from "node:crypto";
import { locations } from "./locations.mjs";
export function distance(a, b) {
  const r = Math.PI / 180,
    dl = (b.lat - a.lat) * r,
    dn = (b.lng - a.lng) * r;
  const h =
    Math.sin(dl / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2;
  return (
    6371 *
    2 *
    Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)))
  );
}
export const score = (km) => Math.round(5000 * Math.exp(-km / 2000));
export function validateGuess(g) {
  if (
    !g ||
    typeof g.lat !== "number" ||
    typeof g.lng !== "number" ||
    !Number.isFinite(g.lat) ||
    !Number.isFinite(g.lng) ||
    Math.abs(g.lat) > 90 ||
    Math.abs(g.lng) > 180
  )
    throw new Error("Choose a valid point on the map.");
}
export function createRoom(owner, practice = false) {
  const deck = [...locations];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return {
    code: randomBytes(4).toString("hex").slice(0, 6).toUpperCase(),
    players: [owner],
    round: 0,
    phase: "lobby",
    deck: deck.slice(0, 3),
    guesses: {},
    results: [],
    ready: [],
    createdAt: Date.now(),
    practice,
    chain: { mode: "local", verified: false },
  };
}
export function joinRoom(room, id) {
  if (room.players.includes(id)) return;
  if (room.players.length >= 2 || room.phase !== "lobby")
    throw new Error("This room is already full.");
  room.players.push(id);
  room.phase = "guessing";
  room.startedAt = Date.now();
}
export function guess(room, id, g) {
  if (!room.players.includes(id)) throw new Error("You are not in this room.");
  if (room.phase !== "guessing")
    throw new Error("This round is not accepting guesses.");
  if (room.guesses[id]) throw new Error("Your guess is already locked.");
  validateGuess(g);
  room.guesses[id] = { lat: g.lat, lng: g.lng };
  if (room.players.every((p) => room.guesses[p])) {
    const target = room.deck[room.round];
    const entries = room.players.map((p) => {
      const km = distance(room.guesses[p], target);
      return { player: p, ...room.guesses[p], km, score: score(km) };
    });
    room.results.push({ location: target, entries });
    room.phase = room.round === 2 ? "finished" : "reveal";
  }
}
export function nextRound(room, id) {
  if (!room.players.includes(id)) throw new Error("You are not in this room.");
  if (room.phase !== "reveal")
    throw new Error("Wait for this round to finish.");
  if (!room.ready.includes(id)) room.ready.push(id);
  if (room.players.every((p) => room.ready.includes(p))) {
    room.round++;
    room.guesses = {};
    room.ready = [];
    room.phase = "guessing";
    room.startedAt = Date.now();
  }
}
export function publicRoom(room, id, profiles) {
  const target = room.deck[room.round];
  return {
    code: room.code,
    round: room.round,
    phase: room.phase,
    practice: room.practice,
    chain: room.chain,
    players: room.players.map((p) => ({
      id: p,
      name: profiles[p]?.name || "Traveller",
      locked: !!room.guesses[p],
      ready: room.ready.includes(p),
      score: room.results.reduce(
        (sum, r) => sum + (r.entries.find((e) => e.player === p)?.score || 0),
        0,
      ),
    })),
    clue: { title: target.title, clue: target.clue },
    myGuess: room.guesses[id] || null,
    results: room.results,
  };
}
