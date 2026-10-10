import assert from "node:assert/strict";
const first = process.env.POSTMARK_URL || "http://127.0.0.1:4328";
const second = process.env.POSTMARK_SECOND_URL || "http://127.0.0.1:4329";
async function call(base, path, token, body) {
  const r = await fetch(base + "/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + (token || ""),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await r.json();
  assert.equal(r.status, 200, JSON.stringify(data));
  return data;
}
const [a, b] = await Promise.all([
  call(first, "/session", null, { name: "Concurrent A" }),
  call(second, "/session", null, { name: "Concurrent B" }),
]);
const room = await call(first, "/rooms", a.token, {}),
  path = "/rooms/" + room.code;
await call(second, path + "/join", b.token, {});
for (let round = 0; round < 3; round++) {
  await Promise.all([
    call(first, path + "/guess", a.token, { lat: 10, lng: 20, round }),
    call(second, path + "/guess", b.token, { lat: 30, lng: 40, round }),
  ]);
  const result = await call(second, path, a.token);
  assert.equal(result.results.length, round + 1);
  assert.equal(result.results[round].entries.length, 2);
  if (round < 2)
    await Promise.all([
      call(first, path + "/next", a.token, {}),
      call(second, path + "/next", b.token, {}),
    ]);
}
const [pa, pb] = await Promise.all([
  call(second, "/me", a.token),
  call(first, "/me", b.token),
]);
assert.equal(pa.stamps.length, 3);
assert.equal(pb.stamps.length, 3);
assert.equal(pa.matches.length, 1);
assert.equal(pb.matches.length, 1);
console.log("POSTMARK_CONCURRENCY_PASS");
