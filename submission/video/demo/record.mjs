// Records a real Postmark duel on the live site (MagicBlock devnet) as screencast
// frames with real timestamps. The on-screen player is driven in the browser; the
// friend plays through the public API. Output: clip/frames + times.json + marks.json
import { chromium } from "/Users/gadgetplug/Documents/vibecoding/teampot/app/node_modules/playwright/index.mjs";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { locations } from "../../../server/locations.mjs";

const BASE = process.env.BASE || "https://postmark-teal.vercel.app";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (path, token, body) => {
  const r = await fetch(BASE + "/api" + path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(path + ": " + j.error);
  return j;
};

const dir = "clip";
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal", "--enable-gpu"] });
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
await p.goto(BASE, { waitUntil: "networkidle" });
await p.evaluate(() => localStorage.setItem("postmark-tutorial", "true"));
await p.reload({ waitUntil: "networkidle" });
await wait(1500);

const cdp = await ctx.newCDPSession(p);
const times = [], marks = [];
let n = 0, t0 = null;
cdp.on("Page.screencastFrame", (f) => {
  const file = `${String(n++).padStart(5, "0")}.jpg`;
  writeFileSync(`${dir}/${file}`, Buffer.from(f.data, "base64"));
  times.push([file, f.metadata.timestamp]);
  t0 ??= f.metadata.timestamp;
  cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
});
const mark = (name) => { marks.push([name, Date.now() / 1000]); console.log("mark", name); };
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080 });
const tick = setInterval(() => p.evaluate(() => { document.body.dataset.t = String(Date.now()); }).catch(() => {}), 33);

const drag = async (sel, dx, dy, steps = 40) => {
  const box = await p.locator(sel).first().boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await p.mouse.move(x, y);
  await p.mouse.down();
  for (let i = 1; i <= steps; i++) { await p.mouse.move(x + (dx * i) / steps, y + (dy * i) / steps); await wait(16); }
  await p.mouse.up();
};
const slowType = async (loc, text) => { await loc.click(); await loc.fill(""); await loc.pressSequentially(text, { delay: 70 }); };

// 1) Landing
mark("landing");
await wait(2500);
await drag("canvas", 260, 30);
await wait(1800);

// 2) Create a duel
mark("create");
await slowType(p.getByPlaceholder("What should we call you?"), "Ada");
await wait(500);
await p.getByRole("button", { name: /Challenge a friend/ }).click();
await p.locator(".room-code").waitFor({ timeout: 30000 });
const code = (await p.locator(".room-code").innerText()).trim().slice(0, 6);
await wait(2500);

// 3) Friend joins through the API
mark("join");
const bayo = await api("/session", null, { name: "Bayo" });
await api(`/rooms/${code}/join`, bayo.token, {});
await p.locator(".scoreboard").waitFor({ timeout: 30000 });
await wait(1500);
await p.locator(".chain-chip").waitFor({ timeout: 60000 }).catch(() => {});
mark("chain-live");
await wait(1500);

for (let round = 0; round < 3; round++) {
  mark("round" + round);
  const room = await api(`/rooms/${code}`, bayo.token);
  const target = locations.find((l) => l.title === room.clue.title);
  await wait(round === 0 ? 2800 : 1400);
  if (round === 0) { await drag("canvas", -220, 40); await wait(600); }
  const guess = { lat: +(target.lat + (round === 1 ? -3.2 : 1.4)).toFixed(2), lng: +(target.lng + (round === 2 ? 4.1 : 2.3)).toFixed(2) };
  await slowType(p.getByLabel("Latitude"), String(guess.lat));
  await slowType(p.getByLabel("Longitude"), String(guess.lng));
  await wait(300);
  await p.getByRole("button", { name: "Find my pin" }).click().catch(() => {});
  await wait(1400);
  mark("lock" + round);
  await p.getByRole("button", { name: /Lock my guess/ }).click();
  await wait(1800);
  await api(`/rooms/${code}/guess`, bayo.token, { round, lat: target.lat + 9, lng: target.lng - 14 });
  await p.locator(".reveal-heading").waitFor({ timeout: 30000 });
  mark("reveal" + round);
  await wait(900);
  await p.evaluate(() => window.scrollTo({ top: 260, behavior: "smooth" }));
  await wait(2400);
  if (round === 0) {
    await p.evaluate(() => { const l = document.querySelector(".ledger"); window.scrollTo({ top: l.getBoundingClientRect().top + scrollY - 140, behavior: "smooth" }); });
    mark("ledger0");
    await wait(4200);
    await p.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await wait(900);
  }
  if (round < 2) {
    await p.getByRole("button", { name: /Next destination/ }).click();
    await api(`/rooms/${code}/next`, bayo.token, {});
    await p.locator(".round-label").waitFor({ timeout: 30000 });
    await wait(600);
  }
}

// 4) Final ledger: wait for the settlement on Solana
mark("final");
await wait(2500);
await p.locator(".ledger li", { hasText: "settled on Solana" }).waitFor({ timeout: 90000 });
await p.evaluate(() => { const l = document.querySelector(".ledger"); window.scrollTo({ top: l.getBoundingClientRect().top + scrollY - 120, behavior: "smooth" }); });
mark("ledger-final");
await wait(5000);
const settled = await p.locator(".ledger li", { hasText: "settled on Solana" }).locator("a").getAttribute("href");

// 5) Passport
await p.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
await wait(700);
mark("passport");
await p.getByRole("button", { name: /Open my passport/ }).click();
await wait(4500);
await p.evaluate(() => window.scrollBy({ top: 500, behavior: "smooth" }));
await wait(3000);

// 6) Proof on the Solana explorer
mark("explorer");
await p.goto(settled, { waitUntil: "domcontentloaded" });
await wait(9000);
await p.evaluate(() => window.scrollBy({ top: 500, behavior: "smooth" }));
await wait(4000);
mark("end");

clearInterval(tick);
await cdp.send("Page.stopScreencast");
await wait(300);
writeFileSync(`${dir}/times.json`, JSON.stringify({ frames: times }));
writeFileSync("marks.json", JSON.stringify({ code, settled, marks }, null, 1));
console.log(code, settled, times.length, "frames");
await b.close();
