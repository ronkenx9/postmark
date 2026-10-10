import { existsSync } from "node:fs";
import { resolve, delimiter } from "node:path";
import { spawnSync } from "node:child_process";
const local = resolve(".tools/solana/solana-release/bin/cargo-build-sbf");
const tool =
  process.env.POSTMARK_SBF_BUILDER ||
  (existsSync(local) ? local : "cargo-build-sbf");
const rustup = "/opt/homebrew/opt/rustup/bin";
const env = { ...process.env };
if (existsSync(rustup)) env.PATH = rustup + delimiter + env.PATH;
const result = spawnSync(
  tool,
  ["--manifest-path", "programs/postmark/Cargo.toml"],
  { stdio: "inherit", env },
);
if (result.error) {
  console.error(
    "Install the official Solana build tools or set POSTMARK_SBF_BUILDER.",
  );
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status || 1);
if (!existsSync("target/deploy/postmark_game.so"))
  throw new Error("Compiled program missing.");
console.log("POSTMARK_BUILD_PROGRAM_PASS");
