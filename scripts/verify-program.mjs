import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Connection, Keypair, SystemProgram } from "@solana/web3.js";
import { Chain, decodeGame } from "../server/chain.mjs";
const chain = new Chain();
chain.base = new Connection("http://127.0.0.1:8899", "confirmed");
chain.er = chain.base;
const faucet = await chain.base.requestAirdrop(chain.payer.publicKey, 2e9);
await chain.base.confirmTransaction(faucet, "confirmed");
const code = randomBytes(3).toString("hex").toUpperCase(),
  pda = chain.address(code);
const meta = (pubkey, isWritable = false, isSigner = false) => ({
  pubkey,
  isWritable,
  isSigner,
});
await chain.send(
  chain.base,
  "initialize",
  [
    meta(pda, true),
    meta(chain.payer.publicKey, true, true),
    meta(SystemProgram.programId),
  ],
  Buffer.from(code),
);
assert.equal(decodeGame(await chain.base.getAccountInfo(pda)).round, 0);
const play = [meta(pda, true), meta(chain.payer.publicKey, false, true)];
const attacker = Keypair.generate();
const badMeta = [meta(pda, true), meta(attacker.publicKey, false, true)];
const valid = chain.payer;
chain.payer = attacker;
const airdrop = await chain.base.requestAirdrop(attacker.publicKey, 1e9);
await chain.base.confirmTransaction(airdrop, "confirmed");
await assert.rejects(() =>
  chain.send(
    chain.base,
    "lock_guess",
    badMeta,
    Buffer.concat([Buffer.from([0, 0]), Buffer.alloc(32, 1)]),
  ),
);
chain.payer = valid;
for (let round = 0; round < 3; round++) {
  await assert.rejects(() =>
    chain.send(
      chain.base,
      "settle_round",
      play,
      Buffer.from([round, 0, 0, 0, 0]),
    ),
  );
  await chain.lock(code, round, 0, { lat: 10, lng: 20 });
  await assert.rejects(() =>
    chain.send(
      chain.base,
      "lock_guess",
      play,
      Buffer.concat([Buffer.from([round, 0]), Buffer.alloc(32, 2)]),
    ),
  );
  await chain.lock(code, round, 1, { lat: 12, lng: 24 });
  await assert.rejects(() =>
    chain.send(
      chain.base,
      "settle_round",
      play,
      Buffer.from([round, 255, 255, 0, 0]),
    ),
  );
  await chain.settle(code, round, [4000, 3000]);
  await assert.rejects(() =>
    chain.send(
      chain.base,
      "lock_guess",
      play,
      Buffer.concat([Buffer.from([round, 0]), Buffer.alloc(32, 2)]),
    ),
  );
}
const result = decodeGame(await chain.base.getAccountInfo(pda));
assert.equal(result.finished, true);
assert.equal(result.round, 3);
assert.deepEqual(result.scores, [12000, 9000]);
console.log("POSTMARK_PROGRAM_PASS");
