import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { Chain, PROGRAM } from "../server/chain.mjs";
const chain = new Chain();
const program = await chain.base.getAccountInfo(PROGRAM);
assert.ok(
  program?.executable,
  "Live proof blocked: Postmark is not deployed on devnet yet.",
);
assert.ok(
  (await chain.base.getBalance(chain.payer.publicKey)) > 10000000,
  "Live proof blocked: the dedicated wallet needs free devnet SOL.",
);
const code = randomBytes(3).toString("hex").toUpperCase();
const evidence = {
  code,
  startedAt: new Date().toISOString(),
  ...(await chain.initialize(code)),
};
for (let round = 0; round < 3; round++) {
  for (let player = 0; player < 2; player++)
    evidence.transactions.push(
      await chain.lock(code, round, player, {
        lat: 10 + round,
        lng: 20 + player,
      }),
    );
  evidence.transactions.push({
    signature: await chain.settle(code, round, [4000, 3000]),
  });
}
evidence.result = await chain.finish(code);
assert.deepEqual(evidence.result.state.scores, [12000, 9000]);
assert.equal(evidence.result.state.finished, true);
mkdirSync("submission", { recursive: true });
writeFileSync(
  "submission/chain-evidence.json",
  JSON.stringify(evidence, null, 2),
);
console.log("POSTMARK_CHAIN_PASS");
