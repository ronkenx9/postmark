# Gates: Interactive 3D globe
- [x] G1: Production build supports a real textured sphere, orbit/zoom controls, guessing and revealed markers.
  CHECK: npm run build
  EXPECT: built in
  EVIDENCE: automatic-evidence=v1; definition-sha256=46d72eccd628b28a4b0e974e69890ad856bb5d28a16876531804fc540a571513; exit=0; EXPECT=matched; output-sha256=180a5e72317a2f8ec2a13e77ef85e056dd9091ff3b4646d595076ae56bd5d4dd; output-bytes=704; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/postmark; path=8a2bb05a4e07/26 entries
- [x] G2: Browser proves rotation does not place guesses, click places coordinates, zoom works and locked/reveal state stays read-only.
  EVIDENCE: Manual browser and source review documented in verification notes below.
- [x] G3: Desktop and mobile rendering, console, fallback and resource cleanup reviewed.
  EVIDENCE: Manual browser and source review documented in verification notes below.

Design: preserve three-round geography loop; primary verb is explore globe then pin a guess. No changes to scoring or rewards. One reusable scene owns renderer, camera, pointer gestures and disposal. Camera input and coordinate controls remain separate from match state.
Reference ledger: gameplay-workflows.md read; physics/level redesign/audio not applicable. No new game, physics or audio system introduced.

Verification notes: desktop browser rotation changed visible continent without pinning; click produced coordinates; wheel and buttons zoomed; focus returned to marker; locked click left values unchanged. Two-player reveal rendered Sydney and both routes. Mobile 390px globe framing corrected and viewport/scrollWidth both390; no console warnings/errors observed. Touch gestures supplied by OrbitControls but physical multi-touch not independently exercised. No animation loop runs when idle; resize observer, controls, listeners, textures, geometry and renderer have disposal paths. WebGL fallback reviewed in source, not forced in browser.
