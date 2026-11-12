"""Озвучка длинного ролика через Fish Audio. Читает script.txt, пишет voice/<hash>.wav и lines.json.
    FISH_API_KEY=... python3 voice2.py            # синтез недостающих реплик (кэш по тексту и голосу)
"""
import hashlib, json, os, re, subprocess, sys, time, urllib.request, urllib.error, wave
from concurrent.futures import ThreadPoolExecutor
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'voice'); os.makedirs(OUT, exist_ok=True)
MODEL = os.environ.get('FISH_MODEL', 's2.1-pro-free')
# публичные голоса Fish Audio с обычными названиями (не копии известных людей): id, скорость
VOICES = {
    'N': ('48ec28a45588422b977a86460c11977f', 0.93),   # рассказчик — «Энергичный Рассказчик»
    'A': ('d567e990d9ad433892ed15ecfd70ce54', 1.0),    # Аня — «Молодой Женский Голос»
    'P': ('4177b0a68e4e46879c8e228ae388934f', 0.92),   # Пётр Семёнович — «Adam»
    'R': ('2a1036d645634680b3cc69aeeb60375b', 0.95),   # динамики — «Спокойный женский голос»
    'K': ('aa615eaff73f417e91cfbb4ea0e42df8', 0.95),   # кассирша — «Женский голос»
    'D': ('7312c38557eb4fb384e3874e8e9cea67', 0.85),   # двойник — «Мужской Профессиональный»
}
def parse(path=os.path.join(HERE, 'script.txt')):
    items, shot, chap = [], None, 0
    for raw in open(path, encoding='utf-8'):
        l = raw.rstrip('\n')
        if not l.strip() or l.startswith('#'): continue
        if l.startswith('='):
            a = [x.strip() for x in l[1:].split('|')] + ['', '']
            w = a[0].split(); chars = []
            for cs in a[1].split():
                m = re.match(r'(\w+):(\w+)@([\d.]+)', cs); chars.append({'who': m[1], 'emo': m[2], 'x': float(m[3])})
            shot = {'type': 'shot', 'scene': w[0], 'args': w[1:], 'chars': chars, 'fx': a[2].split()}
            items.append(shot)
        elif l.startswith('@'):
            chap += 1; items.append({'type': 'chapter', 'n': chap, 'title': l.split(None, 2)[2]})
        elif l.startswith('~'):
            items.append({'type': 'pause', 'd': float(l[1:])})
        else:
            m = re.match(r'([NAPRKD]):\s*(\[[^\]]*\])?\s*(.*)', l)
            sp, tag, text = m[1], m[2] or '', m[3]
            h = hashlib.md5(f'{VOICES[sp][0]}|{VOICES[sp][1]}|{tag}|{text}'.encode()).hexdigest()[:12]
            items.append({'type': 'line', 'sp': sp, 'tag': tag, 'text': text, 'id': h})
    return items
def trim(a, sr, thr=0.012, pad=0.04):
    idx = np.where(np.abs(a) > thr)[0]
    return a if not len(idx) else a[max(0, idx[0] - int(pad * sr)): idx[-1] + int(pad * sr)]
def squeeze(a, sr, thr=0.012, keep=0.5):
    w = int(0.02 * sr); e = np.convolve(np.abs(a), np.ones(w) / w, 'same') > thr
    out, i, n = [], 0, len(a)
    while i < n:
        j = i
        while j < n and e[j] == e[i]: j += 1
        seg = a[i:j]
        if not e[i] and len(seg) > keep * sr: h = int(keep * sr / 2); seg = np.concatenate([seg[:h], seg[-h:]])
        out.append(seg); i = j
    return np.concatenate(out)
def synth(it, force=False):
    path = os.path.join(OUT, it['id'] + '.wav')
    if os.path.exists(path) and not force: return it['id'], 'cached'
    vid, speed = VOICES[it['sp']]
    body = (it['tag'] + ' ' + it['text']).strip()
    req = json.dumps({'text': body, 'reference_id': vid, 'format': 'wav', 'normalize': True, 'prosody': {'speed': speed, 'volume': 0}}).encode()
    err = ''
    for attempt in range(10):
        try:
            r = urllib.request.Request('https://api.fish.audio/v1/tts', data=req, method='POST', headers={
                'Authorization': 'Bearer ' + os.environ['FISH_API_KEY'], 'Content-Type': 'application/json', 'model': MODEL})
            data = urllib.request.urlopen(r, timeout=240).read(); break
        except urllib.error.HTTPError as e:
            err = f'{e.code} ' + e.read().decode()[:200]
            if e.code in (401, 402, 403): return it['id'], 'FAIL ' + err
            time.sleep(4 + attempt * 4)
        except Exception as e:
            err = repr(e)[:200]; time.sleep(4 + attempt * 4)
    else:
        return it['id'], 'FAIL ' + err
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', '-', '-f', 's16le', '-ac', '1', '-ar', '44100', '-'], input=data, capture_output=True).stdout
    a = np.frombuffer(raw, '<i2') / 32767
    if len(a) < 4000: return it['id'], 'FAIL empty'
    a = squeeze(trim(a, 44100), 44100); a = a / max(1e-6, np.max(np.abs(a))) * 0.9
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(44100); w.writeframes((a * 32767).astype('<i2').tobytes())
    return it['id'], f'{len(a)/44100:.2f}s'
if __name__ == '__main__':
    items = parse(); lines = [i for i in items if i['type'] == 'line']
    force = set(sys.argv[1:])
    todo = [i for i in lines if i['id'] in force or not os.path.exists(os.path.join(OUT, i['id'] + '.wav'))]
    print('реплик', len(lines), 'к синтезу', len(todo), flush=True)
    with ThreadPoolExecutor(int(os.environ.get('JOBS', '3'))) as ex:
        for n, (i, res) in enumerate(ex.map(lambda it: synth(it, it['id'] in force), todo)):
            print(n + 1, i, res, flush=True)
    json.dump(items, open(os.path.join(HERE, 'lines.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
