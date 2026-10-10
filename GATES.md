# Gates: Postmark — Geo Duels and World Passport

OWNS: postmark/**

Scope: A polished two-player, three-round geography game with collectible passport stamps, real MagicBlock Ephemeral Rollup match state, and a submission package ready before Monday.

- [x] G1: Match rules enforce two players, three rounds, one guess per player, correct distance scoring, and reconnect-safe results.
  CHECK: npm test
  EXPECT: POSTMARK_RULES_PASS
  EVIDENCE: automatic-evidence=v1; definition-sha256=63b289d338952f43042cbfce99bc4a42a57b22cae202d8f718ca259b6456e995; exit=0; EXPECT=matched; output-sha256=aa7cb0f4663606b1ccc0d080f560a25411c75f319072970e675570c3760d2753; output-bytes=365; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/postmark; path=8a2bb05a4e07/26 entries

- [x] G2: Production frontend compiles successfully.
  CHECK: npm run build
  EXPECT: built in
  EVIDENCE: automatic-evidence=v1; definition-sha256=46d72eccd628b28a4b0e974e69890ad856bb5d28a16876531804fc540a571513; exit=0; EXPECT=matched; output-sha256=9fae9b10839806087a3b0e57deddbedc4a1c98d9f723c1abd5399e9dfff2dc94; output-bytes=371; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/postmark; path=8a2bb05a4e07/26 entries

- [x] G3: Two independent browser sessions finish a match, receive stamps, and retain their passport after reload; mobile and desktop have no overflow.
  EVIDENCE: Manual browser evidence, October 10: independent localhost and 127.0.0.1 sessions finished three rounds; guest reloaded after server restart and retained three stamps. Desktop and mobile passport widths matched viewport (1280 and 390). Landing and mobile match inspected. See submission/VERIFICATION.md.

- [ ] G4: Deployed Solana program delegates match state, accepts real guesses on MagicBlock, and commits results back to Solana with recorded transaction evidence.
  CHECK: npm run verify:chain
  EXPECT: POSTMARK_CHAIN_PASS
  EVIDENCE: pending

- [x] G5: Visual review confirms clear onboarding, readable clue and map, responsive controls, reduced-motion support, and polished passport rewards.
  EVIDENCE: Manual browser review on October 10 at desktop and 390px mobile. Labelled coordinate fields used throughout six rounds, focus styles and reduced-motion rules inspected in source; landing and stamp passport screenshots reviewed.

- [ ] G6: Submission package includes public demo, repository, integration explorer evidence, and demo video; current event availability is confirmed.
  EVIDENCE: pending

- [x] G7: Two independent API clients complete a match with protected guesses, membership enforcement, replay rejection and persistent stamps.
  CHECK: npm run test:api
  EXPECT: POSTMARK_API_PASS
  EVIDENCE: automatic-evidence=v1; definition-sha256=ae43cbbd9ff404466231ff908befd1b698f5b9ed7424fe98939239fb39b5ee9c; exit=0; EXPECT=matched; output-sha256=8186a3111f34e4e6aab488f6b584ccd726b050757e044b25b93ebeb7bd016e6e; output-bytes=76; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/postmark; path=8a2bb05a4e07/26 entries

- [x] G8: Compiled Solana program rejects unauthorized writes, duplicate submissions, premature settlement, out-of-range scores and stale rounds on a local validator.
  CHECK: npm run test:program
  EXPECT: POSTMARK_PROGRAM_PASS
  EVIDENCE: automatic-evidence=v1; definition-sha256=7b41696684dfed9957b2db9bcde8e0dd45d11a3759ac334757a653184e79b480; exit=0; EXPECT=matched; output-sha256=cdf357b71088afbac645cb0179784643327f7be0a1b868778c60bfa94cad8a21; output-bytes=88; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/postmark; path=8a2bb05a4e07/26 entries
