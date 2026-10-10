import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  DELEGATION_PROGRAM_ID,
  MAGIC_PROGRAM_ID,
  MAGIC_CONTEXT_ID,
  delegateBufferPdaFromDelegatedAccountAndOwnerProgram,
  delegationRecordPdaFromDelegatedAccount,
  delegationMetadataPdaFromDelegatedAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { readFileSync } from "node:fs";
import { createHash, createHmac } from "node:crypto";
export const PROGRAM = new PublicKey(
  "F3zG6GJkibp3HB7tFrt32UGaiJaSEarAJ3QWnmgiRqs6",
);
const discriminator = (name) =>
  createHash("sha256")
    .update("global:" + name)
    .digest()
    .subarray(0, 8);
const key = (pubkey, isWritable = false, isSigner = false) => ({
  pubkey,
  isWritable,
  isSigner,
});
export function decodeGame(info) {
  if (!info || info.data.length !== 121)
    throw new Error("Missing or malformed game account.");
  const d = info.data;
  const expected = createHash("sha256")
    .update("account:Game")
    .digest()
    .subarray(0, 8);
  if (!d.subarray(0, 8).equals(expected))
    throw new Error("Wrong game discriminator.");
  return {
    authority: new PublicKey(d.subarray(8, 40)).toBase58(),
    room: d.subarray(40, 46).toString(),
    round: d[46],
    locked: d[47],
    scores: [d.readUInt32LE(48), d.readUInt32LE(52)],
    commitments: [
      d.subarray(56, 88).toString("hex"),
      d.subarray(88, 120).toString("hex"),
    ],
    finished: d[120] === 1,
  };
}
export class Chain {
  constructor() {
    this.base = new Connection(
      process.env.SOLANA_RPC || "https://api.devnet.solana.com",
      "confirmed",
    );
    this.er = new Connection(
      process.env.MAGICBLOCK_RPC || "https://devnet-as.magicblock.app",
      "confirmed",
    );
    this.payer = Keypair.fromSecretKey(
      Uint8Array.from(
        JSON.parse(
          readFileSync(
            process.env.POSTMARK_DEVNET_KEY ||
              new URL("../keys/devnet.json", import.meta.url),
            "utf8",
          ),
        ),
      ),
    );
  }
  address(code) {
    if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error("Invalid room code.");
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("postmark"),
        this.payer.publicKey.toBuffer(),
        Buffer.from(code),
      ],
      PROGRAM,
    )[0];
  }
  async send(connection, name, keys, data = Buffer.alloc(0)) {
    if (!this.checkedNetwork) {
      const host = new URL(this.base.rpcEndpoint).hostname;
      const local = host === "127.0.0.1" || host === "localhost";
      if (
        !local &&
        (await this.base.getGenesisHash()) !==
          "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"
      ) {
        throw new Error(
          "Postmark only supports Solana devnet or a local validator.",
        );
      }
      this.checkedNetwork = true;
    }
    const tx = new Transaction().add(
      new TransactionInstruction({
        programId: PROGRAM,
        keys,
        data: Buffer.concat([discriminator(name), data]),
      }),
    );
    return sendAndConfirmTransaction(connection, tx, [this.payer], {
      commitment: "confirmed",
      maxRetries: 3,
    });
  }
  async initialize(code) {
    const pda = this.address(code);
    const initialize = await this.send(
      this.base,
      "initialize",
      [
        key(pda, true),
        key(this.payer.publicKey, true, true),
        key(SystemProgram.programId),
      ],
      Buffer.from(code),
    );
    const identityResponse = await fetch(this.er.rpcEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getIdentity" }),
    });
    const identity = await identityResponse.json();
    if (!identityResponse.ok || identity.error || !identity.result?.identity)
      throw new Error("Cannot resolve MagicBlock validator identity.");
    const validator = new PublicKey(identity.result.identity);
    const delegate = await this.send(
      this.base,
      "delegate",
      [
        key(this.payer.publicKey, true, true),
        key(
          delegateBufferPdaFromDelegatedAccountAndOwnerProgram(pda, PROGRAM),
          true,
        ),
        key(delegationRecordPdaFromDelegatedAccount(pda), true),
        key(delegationMetadataPdaFromDelegatedAccount(pda), true),
        key(pda, true),
        key(PROGRAM),
        key(DELEGATION_PROGRAM_ID),
        key(SystemProgram.programId),
        key(validator),
      ],
      Buffer.from(code),
    );
    await this.wait(
      this.er,
      pda,
      (g) => g.round === 0 && g.authority === this.payer.publicKey.toBase58(),
    );
    return {
      mode: "magicblock-devnet",
      verified: true,
      address: pda.toBase58(),
      initialize,
      delegate,
      transactions: [],
    };
  }
  async wait(connection, pda, predicate) {
    for (let i = 0; i < 25; i++) {
      const info = await connection.getAccountInfo(pda);
      if (info) {
        const game = decodeGame(info);
        if (predicate(game, info)) return game;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("Timed out waiting for verified chain state.");
  }
  async lock(code, round, player, guess) {
    const commitment = createHmac("sha256", this.payer.secretKey)
      .update(
        JSON.stringify({ code, round, player, lat: guess.lat, lng: guess.lng }),
      )
      .digest();
    const state = decodeGame(await this.er.getAccountInfo(this.address(code)));
    if (state.round > round) return { signature: null, recovered: true };
    if (state.round === round && state.locked & (1 << player)) {
      if (state.commitments[player] !== commitment.toString("hex"))
        throw new Error(
          "This guess is already locked on-chain. Retry your original coordinates.",
        );
      return {
        signature: null,
        commitment: commitment.toString("hex"),
        recovered: true,
      };
    }
    const signature = await this.send(
      this.er,
      "lock_guess",
      [key(this.address(code), true), key(this.payer.publicKey, false, true)],
      Buffer.concat([Buffer.from([round, player]), commitment]),
    );
    return { signature, commitment: commitment.toString("hex") };
  }
  async settle(code, round, scores) {
    const state = decodeGame(await this.er.getAccountInfo(this.address(code)));
    if (state.round > round) return null;
    const data = Buffer.alloc(5);
    data[0] = round;
    data.writeUInt16LE(scores[0], 1);
    data.writeUInt16LE(scores[1], 3);
    return this.send(
      this.er,
      "settle_round",
      [key(this.address(code), true), key(this.payer.publicKey, false, true)],
      data,
    );
  }
  async finish(code) {
    const base = await this.base.getAccountInfo(this.address(code));
    if (base && base.owner.equals(PROGRAM)) {
      const state = decodeGame(base);
      if (state.finished) return { signature: null, state, recovered: true };
    }
    const signature = await this.send(this.er, "finish", [
      key(this.payer.publicKey, true, true),
      key(this.address(code), true),
      key(MAGIC_PROGRAM_ID),
      key(MAGIC_CONTEXT_ID, true),
    ]);
    const state = await this.wait(
      this.base,
      this.address(code),
      (g, info) => g.finished && g.round === 3 && info.owner.equals(PROGRAM),
    );
    return { signature, state };
  }
}
