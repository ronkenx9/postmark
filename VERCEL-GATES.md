# Gates: Vercel public deployment
- [x] V1: Stateless API uses persistent storage and prevents concurrent updates from losing guesses or stamps.
  CHECK: POSTMARK_URL=https://postmark-teal.vercel.app POSTMARK_SECOND_URL=https://postmark-teal.vercel.app node scripts/verify-concurrency.mjs
  EXPECT: POSTMARK_CONCURRENCY_PASS
  EVIDENCE: automatic-evidence=v1; definition-sha256=a566def55c71d877592974ddefc75529bf991f99c9b2847d052b9322f1996c24; exit=0; EXPECT=matched; output-sha256=ea651fc5430e9687149dd264ac47c00a9c5ede1fa0a9e1b3cfbe1b25beaaefab; output-bytes=26; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/postmark; path=8a2bb05a4e07/26 entries
- [x] V2: Production build succeeds with serverless entrypoint.
  CHECK: npm run build
  EXPECT: built in
  EVIDENCE: automatic-evidence=v1; definition-sha256=46d72eccd628b28a4b0e974e69890ad856bb5d28a16876531804fc540a571513; exit=0; EXPECT=matched; output-sha256=1296f4660138a7f5532fc1092683068f039f69383911b78a7555a06e6d8de43d; output-bytes=705; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/postmark; path=8a2bb05a4e07/26 entries
- [x] V3: Public Vercel URL passes full two-player API lifecycle and browser globe smoke check.
  EVIDENCE: October 10 public Vercel API passed full multiplayer lifecycle. Public browser completed practice match 1E6442 at 14992 vs 7655, restored the finished match after reload and showed all three stamps. Public tutorial pin and reveal also verified; screenshot submission/tutorial.jpg.
- [x] V4: Tutorial opens automatically for a new visitor, supports a practice pin/reveal, closes accessibly, and is reachable again from How to play.
  EVIDENCE: October 10 local browser completed all four tutorial steps with real practice pin and reveal, then reopened via How to play, dismissed with Escape, and verified no automatic replay on reload. Public mobile tutorial inspected at 390px without horizontal overflow.
