import assert from "node:assert/strict";
const base = process.env.POSTMARK_URL || "http://127.0.0.1:4327";
async function call(path, token, body, status = 200) {
  const r = await fetch(base + "/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + (token || ""),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const d = await r.json();
  assert.equal(r.status, status, JSON.stringify(d));
  return d;
}
const a = await call("/session", null, { name: "API traveller A" }),
  b = await call("/session", null, { name: "API traveller B" }),
  outsider = await call("/session", null, { name: "Not in room" });
const room = await call("/rooms", a.token, {});
const p = "/rooms/" + room.code;
await call(p + "/join", b.token, {});
await call(p, outsider.token, undefined, 403);
await call(p + "/join", outsider.token, {}, 400);
for (let round = 0; round < 3; round++) {
  await call(p + "/guess", a.token, { lat: 91, lng: 0, round }, 400);
  await call(p + "/guess", a.token, { lat: 0, lng: 0, round });
  await call(p + "/guess", a.token, { lat: 0, lng: 0, round }, 400);
  const hidden = await call(p, b.token);
  assert.equal(hidden.myGuess, null);
  assert.equal(hidden.results.length, round);
  assert.equal(hidden.deck, undefined);
  const result = await call(p + "/guess", b.token, { lat: 30, lng: 30, round });
  assert.equal(result.results.length, round + 1);
  if (round < 2) {
    await call(p + "/next", a.token, {});
    const waiting = await call(p, b.token);
    assert.equal(waiting.phase, "reveal");
    await call(p + "/next", b.token, {});
    await call(p + "/guess", a.token, { lat: 0, lng: 0, round }, 400);
  }
}
const finished = await call(p, a.token);
assert.equal(finished.phase, "finished");
const passport = await call("/me", a.token);
assert.equal(passport.stamps.length, 3);
assert.equal(passport.matches.length, 1);
await call(p + "/guess", a.token, { lat: 0, lng: 0, round: 2 }, 400);
assert.equal((await call("/me", a.token)).stamps.length, 3);
console.log("POSTMARK_API_PASS");
