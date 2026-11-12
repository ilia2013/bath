"""Собирает таймлайн из lines.json и длительностей реплик: timeline.js (для рендера) и timeline.json (для звука)."""
import json, os, wave
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
items = json.load(open(os.path.join(HERE, 'lines.json'), encoding='utf-8'))
GAP, CH = 0.42, 3.4
t, shots, lines, chapters, cur = 0.0, [], [], [], None
def start_shot(scene, A, K, chars, fx):
    global cur
    if cur: cur['d'] = round(t - cur['t0'], 3)
    cur = {'t0': round(t, 3), 'scene': scene, 'A': A, 'K': K, 'chars': chars, 'fx': fx, 'i': len(shots)}; shots.append(cur)
for it in items:
    if it['type'] == 'shot':
        A = [a for a in it['args'] if '=' not in a]; K = dict(a.split('=', 1) for a in it['args'] if '=' in a)
        start_shot(it['scene'], A, K, it['chars'], it['fx']); t += 0.3
    elif it['type'] == 'chapter':
        start_shot('chapter', [], {'n': it['n'], 'title': it['title']}, [], ['chapter'])
        chapters.append({'t': round(t, 2), 'n': it['n'], 'title': it['title']}); t += CH
    elif it['type'] == 'pause': t += it['d']
    else:
        with wave.open(os.path.join(HERE, 'voice', it['id'] + '.wav')) as w:
            sr = w.getframerate(); a = np.frombuffer(w.readframes(w.getnframes()), '<i2') / 32767
        d = len(a) / sr; hop = sr // 30
        env = [float(np.sqrt(np.mean(a[i:i + hop] ** 2))) for i in range(0, len(a), hop)]; m = max(env) or 1
        lines.append({'t0': round(t, 3), 'd': round(d, 3), 'sp': it['sp'], 'text': it['text'], 'id': it['id'], 'env': [round(min(1, e / m * 1.3), 2) for e in env]})
        t += d + GAP
t += 1.0
cur['d'] = round(t - cur['t0'], 3)
tl = {'dur': round(t, 3), 'shots': shots, 'lines': lines, 'chapters': chapters}
open(os.path.join(HERE, 'timeline.js'), 'w', encoding='utf-8').write('window.TIMELINE = ' + json.dumps(tl, ensure_ascii=False) + ';\n')
json.dump(tl, open(os.path.join(HERE, 'timeline.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print(f'длина {t/60:.2f} мин ({t:.1f} с), шотов {len(shots)}, реплик {len(lines)}, речь {sum(l["d"] for l in lines)/60:.1f} мин')
for ch in chapters: print(f'{int(ch["t"]//60)}:{int(ch["t"]%60):02d} Глава {ch["n"]}. {ch["title"].capitalize()}')
