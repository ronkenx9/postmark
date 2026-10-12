# usage: python3 tts.py <text.json> <out-prefix>  (voice: George)
import json,sys,urllib.request,base64,os
k=open(os.path.expanduser('~/Documents/vibecoding/lose-the-tail/trailer-workshop/.env')).read().split('ELEVENLABS_API_KEY=')[1].split()[0].strip('"\'')
text=json.load(open(sys.argv[1]))['text']; out=sys.argv[2]
body=json.dumps({"text":text,"model_id":"eleven_multilingual_v2","voice_settings":{"stability":0.5,"similarity_boost":0.8,"style":0.25,"use_speaker_boost":True}}).encode()
req=urllib.request.Request("https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb/with-timestamps?output_format=mp3_44100_128",data=body,headers={"xi-api-key":k,"Content-Type":"application/json"})
d=json.load(urllib.request.urlopen(req,timeout=180))
open(out+'.mp3','wb').write(base64.b64decode(d['audio_base64']))
a=d['alignment'];words=[];cur='';s0=pe=None
for c,s,e in zip(a['characters'],a['character_start_times_seconds'],a['character_end_times_seconds']):
    if c.isspace():
        if cur: words.append({"text":cur,"start":s0,"end":pe}); cur=''
        continue
    if not cur: s0=s
    cur+=c; pe=e
if cur: words.append({"text":cur,"start":s0,"end":pe})
json.dump(words,open(out+'-words.json','w'))
print(len(words),'words; ends at',round(words[-1]['end'],2))
