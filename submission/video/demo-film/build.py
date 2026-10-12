# Generates index.html: the live recording cut into segments, VO lines, caption cards.
import json, subprocess
D = lambda f: float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",f]))
INTRO, OUTRO = 2.6, 3.2
# (src start, src end, rate, vo, eyebrow, caption)
SEG = [
 (0.0, 5.1, 1.0, "d1", "Postmark", "Live on Solana devnet"),
 (5.1, 13.7, 1.0, "d2", "Start a duel", "Challenge a friend"),
 (13.7, 22.3, 1.0, "d3", "MagicBlock", "The match moves onto a rollup"),
 (22.3, 29.4, 1.0, "d4", "Round one", "Lock your pin. Reveal together."),
 (29.4, 36.2, 1.0, "d5", "Match ledger", "Every step, on chain"),
 (36.2, 59.0, 1.6, "d6", "Rounds two and three", "No wallet. No fees for players."),
 (59.0, 67.7, 1.0, "d7", "Final score", "Committed back to Solana"),
 (67.7, 75.2, 1.0, "d8", "Passport", "Three stamps collected"),
 (75.2, 85.2, 1.0, "d9", "Proof", "Settled on the Solana explorer"),
]
clips, vos, caps, tl = [], [], [], []
t, vo_free = INTRO, 0.0
for i,(a,b,rate,vo,eb,cap) in enumerate(SEG):
    out = (b-a)/rate
    clips.append(f'<video id="v{i}" class="clip" src="assets/raw.mp4" muted playsinline data-start="{t:.3f}" data-media-start="{a:.3f}" data-duration="{out:.3f}" data-playback-rate="{rate}" data-track-index="1"></video>')
    vstart = max(t + 0.25, vo_free + 0.15)
    vd = D(f"assets/{vo}.mp3")
    vos.append(f'<audio id="a{vo}" src="assets/{vo}.mp3" data-start="{vstart:.3f}" data-duration="{vd:.3f}" data-track-index="3" data-volume="1"></audio>')
    vo_free = vstart + vd
    pos = ' top' if vo in ("d5", "d7") else ''
    caps.append(f'<div class="cap clip{pos}" id="c{i}" data-start="{t+0.15:.3f}" data-duration="{out-0.3:.3f}" data-track-index="2"><span class="eb"><i></i>{eb}</span><span class="tx">{cap}</span></div>')
    tl.append(f'tl.fromTo("#c{i}", {{ y: 30, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }}, {t+0.2:.3f});')
    tl.append(f'tl.to("#c{i}", {{ opacity: 0, duration: 0.25 }}, {t+out-0.45:.3f});')
    t += out
total = round(max(t, vo_free + 0.4) + OUTRO, 2)
outro_at = total - OUTRO
music = f'<audio id="music" src="assets/bgm.mp3" data-start="0" data-duration="{total}" data-track-index="4" data-volume="0.09"></audio>'
logo = '<span class="mark"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/></svg></span>'
html = f'''<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=1920, height=1080" />
<title>Postmark Demo</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&family=Libre+Caslon+Display&display=swap" rel="stylesheet">
<style>
:root {{ --paper:#f4f1e8; --ink:#263a30; --muted:#5a6056; --orange:#df492e; }}
* {{ margin:0; padding:0; box-sizing:border-box; }}
html,body {{ width:1920px; height:1080px; overflow:hidden; background:var(--paper); }}
#root {{ position:relative; width:100%; height:100%; overflow:hidden; background:var(--paper); font-family:"DM Sans",sans-serif; color:var(--ink); }}
video {{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }}
.card {{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; background:var(--paper); }}
.brand {{ display:flex; align-items:center; gap:22px; font:700 110px/1 "DM Sans"; letter-spacing:-4px; }}
.mark {{ width:120px; height:120px; border-radius:26px; background:var(--orange); display:flex; align-items:center; justify-content:center; transform:rotate(-6deg); }}
.mark svg {{ width:70px; height:70px; }}
.sub {{ font:60px/1.1 "Libre Caslon Display"; margin-top:34px; }}
.sub em {{ color:var(--orange); font-style:normal; }}
.kick {{ font:500 22px "DM Mono"; letter-spacing:.3em; color:var(--muted); margin-top:30px; text-transform:uppercase; }}
.cap {{ position:absolute; left:56px; bottom:56px; display:flex; flex-direction:column; gap:10px; padding:22px 30px 24px; background:rgba(244,241,232,.96); border:1.5px solid rgba(38,58,48,.18); border-radius:18px; box-shadow:0 18px 40px rgba(38,58,48,.16); }}
.cap.top {{ bottom:auto; left:auto; top:40px; right:56px; }}
.cap .eb {{ display:flex; align-items:center; gap:10px; font:500 17px "DM Mono"; letter-spacing:.22em; text-transform:uppercase; color:var(--muted); }}
.cap .eb i {{ width:9px; height:9px; border-radius:50%; background:var(--orange); display:block; }}
.cap .tx {{ font:44px/1.05 "Libre Caslon Display"; color:var(--ink); }}
</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{total}" data-width="1920" data-height="1080">
<div id="intro" class="card clip" data-start="0" data-duration="{INTRO:.2f}" data-track-index="5"><div class="brand">{logo}postmark</div><div class="kick">Product demo · MagicBlock Ephemeral Rollups</div></div>
{chr(10).join(clips)}
{chr(10).join(caps)}
<div id="outro" class="card clip" data-start="{outro_at:.3f}" data-duration="{OUTRO}" data-track-index="5"><div class="brand">{logo}postmark</div><div class="sub">A world worth <em>guessing.</em></div><div class="kick">postmark-teal.vercel.app · github.com/ronkenx9/postmark</div></div>
{chr(10).join(vos)}
{music}
</div>
<script>
const tl = gsap.timeline({{ paused: true }});
tl.fromTo("#intro .brand", {{ y: 30, opacity: 0, scale: 0.94 }}, {{ y: 0, opacity: 1, scale: 1, duration: 0.8, ease: "power3.out" }}, 0.15);
tl.fromTo("#intro .kick", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.6 }}, 0.7);
tl.to("#intro .brand, #intro .kick", {{ opacity: 0, y: -20, duration: 0.35, ease: "power2.in" }}, {INTRO-0.4:.2f});
{chr(10).join(tl)}
tl.fromTo("#outro .brand", {{ y: 30, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.7, ease: "power3.out" }}, {outro_at+0.1:.3f});
tl.fromTo("#outro .sub", {{ y: 20, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.7, ease: "power3.out" }}, {outro_at+0.45:.3f});
tl.fromTo("#outro .kick", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.6 }}, {outro_at+0.9:.3f});
window.__timelines["main"] = tl;
</script></body></html>'''
open("index.html","w").write(html)
print("total", total)
