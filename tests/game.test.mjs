import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createRoom,
  joinRoom,
  guess,
  nextRound,
  publicRoom,
  distance,
  score,
  validateGuess,
} from "../server/game.mjs";
test("scoring handles identical, opposite and date-line coordinates", () => {
  assert.equal(distance({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }), 0);
  assert.equal(score(0), 5000);
  assert.ok(
    Math.abs(distance({ lat: 0, lng: 0 }, { lat: 0, lng: 180 }) - 20015) < 1,
  );
  assert.ok(distance({ lat: 0, lng: 179 }, { lat: 0, lng: -179 }) < 223);
  for (const g of [
    { lat: NaN, lng: 0 },
    { lat: 91, lng: 0 },
    { lat: 0, lng: 181 },
    { lat: "1", lng: 0 },
  ])
    assert.throws(() => validateGuess(g));
});
test("two-player match conceals guesses, rejects replay and completes three rounds", () => {
  const r = createRoom("a");
  joinRoom(r, "b");
  assert.throws(() => joinRoom(r, "c"));
  for (let round = 0; round < 3; round++) {
    const loc = r.deck[round];
    guess(r, "a", { lat: loc.lat, lng: loc.lng });
    assert.equal(publicRoom(r, "b", {}).myGuess, null);
    assert.equal(publicRoom(r, "b", {}).results.length, round);
    assert.equal(publicRoom(r, "b", {}).deck, undefined);
    assert.throws(() => guess(r, "a", { lat: 0, lng: 0 }));
    assert.throws(() => guess(r, "intruder", { lat: 0, lng: 0 }));
    guess(r, "b", { lat: 0, lng: 0 });
    if (round < 2) {
      nextRound(r, "a");
      assert.equal(r.phase, "reveal");
      nextRound(r, "a");
      assert.equal(r.phase, "reveal");
      nextRound(r, "b");
      assert.equal(r.phase, "guessing");
    }
  }
  assert.equal(r.phase, "finished");
  assert.equal(r.results.length, 3);
  assert.equal(publicRoom(r, "a", {}).players[0].score, 15000);
  assert.throws(() => nextRound(r, "a"));
  console.log("POSTMARK_RULES_PASS");
});
