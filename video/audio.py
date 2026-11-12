"""Звуковая дорожка для мультика: всё синтезируется из синусов и шума (numpy), без сэмплов.
Читает out/events.json (его пишет render.mjs) и создаёт out/audio.wav."""
import json, os, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
info = json.load(open(os.path.join(HERE, 'out', 'events.json'), encoding='utf-8'))
SR = 44100
DUR = info['DUR']
N = int(SR * (DUR + 0.05))
mixL = np.zeros(N); mixR = np.zeros(N)
rng = np.random.default_rng(7)
SCN = {s['n']: s for s in info['SCENES']}
EV = info['EVENTS']
def ev(name): return [e['t'] for e in EV if e['name'] == name]
def sc(name, dt=0.0): return SCN[name]['t0'] + dt
def sc_end(name): return SCN[name]['t0'] + SCN[name]['d']

def tt(d): return np.arange(int(SR * d)) / SR
def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N or i < 0: return
    sig = sig[:N - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    mixL[i:i + len(sig)] += sig * gain * l * 1.414
    mixR[i:i + len(sig)] += sig * gain * r * 1.414
def fade(sig, a=0.01, r=0.05):
    n = len(sig); e = np.ones(n)
    na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return sig * e
def noise(d): return rng.standard_normal(int(SR * d))
def bandf(sig, lo, hi):
    """Полосовой фильтр через БПФ."""
    S = np.fft.rfft(sig); f = np.fft.rfftfreq(len(sig), 1 / SR)
    g = 1 / (1 + (f / max(hi, 1)) ** 6) * (1 - 1 / (1 + (f / max(lo, 1)) ** 6))
    return np.fft.irfft(S * g, len(sig))
def sweep(f0, f1, d, shape=1.0):
    t = tt(d); k = (t / d) ** shape
    return np.sin(2 * np.pi * np.cumsum(f0 + (f1 - f0) * k) / SR)

# ---------- инструменты ----------
def thump(f=85, d=0.4, drop=0.55, click=0.5):
    t = tt(d); fr = f * (drop + (1 - drop) * np.exp(-t * 18))
    ph = 2 * np.pi * np.cumsum(fr) / SR
    s = (np.sin(ph) + 0.45 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph)) * np.exp(-t * 11)
    c = bandf(noise(d), 300, 2500) * np.exp(-t * 60) * click
    return fade(s + c, 0.002, 0.05)
def boom(d=2.2, f=46):
    t = tt(d); s = np.sin(2 * np.pi * np.cumsum(f * (0.6 + 0.4 * np.exp(-t * 6))) / SR) * np.exp(-t * 2.2)
    n = bandf(noise(d), 30, 500) * np.exp(-t * 5) * 0.8
    return fade(s + n, 0.002, 0.3)
def whoosh(d=0.5, lo=400, hi=5000):
    t = tt(d); e = np.sin(np.pi * t / d) ** 2
    return bandf(noise(d), lo, hi) * e
def ding(f=1318.5, d=0.9):
    t = tt(d); s = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.5 * t) + 0.2 * np.sin(2 * np.pi * f * 2.01 * t)
    return fade(s * np.exp(-t * 6), 0.003, 0.05)
def pluck(f, d=0.5, bright=3.0):
    t = tt(d); s = sum(np.sin(2 * np.pi * f * k * t) / k ** 1.4 * np.exp(-t * (3 + k * bright)) for k in range(1, 7))
    return fade(s, 0.003, 0.03)
def bell(f, d=1.2):
    t = tt(d); s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 6) + 0.2 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 12)
    return fade(s * np.exp(-t * 3.2), 0.004, 0.05)
def pad(freqs, d, a=0.8, r=1.0, vib=0.25):
    t = tt(d); s = np.zeros(len(t))
    for i, f in enumerate(freqs):
        for det in (-0.35, 0.35):
            ph = 2 * np.pi * (f + det) * t + vib * np.sin(2 * np.pi * (0.13 + 0.05 * i) * t + i)
            s += np.sin(ph) + 0.25 * np.sin(2 * ph)
    return fade(s / len(freqs), a, r)
def sting(d=1.3, base=233.0):
    t = tt(d); s = np.zeros(len(t))
    for f in (base, base * 1.06, base * 1.414, base * 2.12, base * 2.98):
        s += np.sign(np.sin(2 * np.pi * f * t)) * 0.4 + np.sin(2 * np.pi * f * t * (1 + 0.004 * np.sin(2 * np.pi * 7 * t)))
    s = bandf(s, 150, 3800) * np.exp(-t * 2.6)
    return fade(s / 5, 0.004, 0.2)
def power_down(d=1.0):
    t = tt(d); ph = np.cumsum(420 * np.exp(-t * 4.2) + 28) / SR * 2 * np.pi
    s = (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.3 * np.sin(3 * ph)) * (1 - t / d) ** 0.6
    return fade(s, 0.003, 0.1)
def heart(d=0.5):
    a = thump(70, 0.22, 0.6, 0.3); b = thump(60, 0.25, 0.6, 0.22)
    s = np.zeros(int(SR * d)); s[:len(a)] += a; i = int(0.27 * SR * min(1, d / 0.5)); s[i:i + len(b)] += b[:len(s) - i] * 0.7
    return s
def tick(d=0.05, f=2400):
    t = tt(d); return (np.sin(2 * np.pi * f * t) + bandf(noise(d), 1500, 7000) * 0.6) * np.exp(-t * 140)
def chirp(d=0.14):
    t = tt(d); f = 3200 + 1500 * np.sin(np.pi * t / d) + rng.uniform(-300, 300)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 2
def riser(d=2.6):
    t = tt(d); k = t / d
    s = sweep(90, 900, d, 2.2) * 0.5 + bandf(noise(d), 500, 6000) * 0.6 + sweep(93, 940, d, 2.2) * 0.4
    return s * k ** 2

A = 55.0
def note(semi, base=A): return base * 2 ** (semi / 12)

# ---------- 1. вступление: спокойный вечер ----------
t_off = ev('lights_out')[0]
add(pad([note(12), note(15), note(19), note(22)], t_off + 0.1, 0.6, 0.15), 0, 0.10)        # Am7
add(bandf(noise(t_off), 80, 700) * 0.5, 0, 0.05)                                             # гул города
for i, tb in enumerate(np.arange(0.3, t_off - 0.2, 0.55)):
    add(bell(note([24, 31, 27, 34][i % 4])), tb, 0.07, pan=(-0.4, 0.4)[i % 2])
add(power_down(1.1), t_off, 0.5)
add(thump(50, 0.6, 0.5, 1.0), t_off, 0.6)

# ---------- 2. дрон темноты (от отключения до рассвета) ----------
t_dawn = sc('dawn')
d = t_dawn - t_off
t = tt(d)
drone = (np.sin(2 * np.pi * 55 * t) + 0.7 * np.sin(2 * np.pi * 55.6 * t) + 0.5 * np.sin(2 * np.pi * 82.4 * t + np.sin(2 * np.pi * 0.11 * t))
         + 0.25 * np.sin(2 * np.pi * 110.3 * t) + 0.12 * np.sin(2 * np.pi * 165.2 * t) + 0.08 * np.sin(2 * np.pi * 220.9 * t)) * (0.75 + 0.25 * np.sin(2 * np.pi * 0.19 * t))
wind = bandf(noise(d), 200, 900) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * t + 1)) * 0.5
add(fade(drone, 0.8, 0.6), t_off, 0.085)
add(fade(wind, 1.0, 0.6), t_off, 0.05)

# ---------- 3. стук ----------
for tk in ev('knock'): add(thump(95, 0.35, 0.6, 1.2), tk, 0.75, pan=-0.35)
for tk in ev('knock_big'): add(thump(80, 0.5, 0.5, 1.4), tk, 1.0, pan=-0.35); add(boom(1.2, 50), tk, 0.3)

# ---------- 4. заставка и правила: пульс + арпеджио ----------
t_title = ev('title')[0]
add(whoosh(0.4), t_title - 0.3, 0.3); add(boom(2.0), t_title, 0.75); add(bandf(noise(1.2), 3000, 12000) * np.exp(-tt(1.2) * 4), t_title, 0.16)
for tb in ev('bulb'): add(power_down(0.5), tb, 0.3); add(tick(0.08, 3000), tb, 0.4)
BEAT = 0.3
arp = [0, 3, 7, 12, 7, 3, 1, 3]                      # ля минор с «тревожной» секундой
t_music_end = sc('hide')
k = 0
for tb in np.arange(t_title, t_music_end - 0.05, BEAT):
    in_card = any(sc(c) <= tb < sc_end(c) for c in ('card1', 'card2', 'card3'))
    if k % 2 == 0: add(pluck(A * (1 if (k // 8) % 4 != 3 else 2 ** (-2 / 12)), 0.5, 2.0), tb, 0.26)
    if k % 4 == 2: add(bandf(noise(0.1), 1500, 9000) * np.exp(-tt(0.1) * 50), tb, 0.07)
    g = 0.035 if not in_card else 0.06
    add(bell(note(24 + arp[k % 8]), 0.7), tb, g, pan=(-0.5, 0.5)[k % 2])
    k += 1
for tr in ev('rule'):
    add(whoosh(0.3), tr - 0.22, 0.35); add(boom(1.0, 60), tr, 0.6); add(sting(0.5, 440), tr, 0.10)

# ---------- 5. дверь и глазок ----------
for tw in ev('whisper'):
    dd = 2.4; tw_t = tt(dd)
    w = bandf(noise(dd), 900, 4200) * (0.5 + 0.5 * np.sin(2 * np.pi * 5.5 * tw_t)) ** 2 * np.sin(np.pi * tw_t / dd)
    add(w, tw, 0.13, pan=0.3)
for tc in ev('creep'):
    dd = 3.8; s = pad([note(36), note(37), note(43.5)], dd, 1.5, 0.2, 0.6) * np.linspace(0.2, 1, int(SR * dd))
    add(s, tc, 0.07)
for tj in ev('jump'): add(sting(0.9, 311), tj, 0.2); add(thump(60, 0.5, 0.5, 0.6), tj, 0.6)
for tj in ev('jump_big'): add(sting(1.5, 233), tj, 0.32); add(boom(1.6), tj, 0.7)

# ---------- 6. окно ----------
for tcl in ev('click'): add(tick(0.06, 1800), tcl, 0.6); add(thump(140, 0.08, 0.8, 1.5), tcl, 0.25)
for i, te in enumerate(ev('eye')): add(bell(note(48 + [0, 1, 6, 7, 12, 13][i % 6]), 0.6), te, 0.07, pan=rng.uniform(-0.7, 0.7))
for te in ev('egg'): add(pad([note(49), note(50)], 1.6, 0.6, 0.6, 0.8), te, 0.035)

# ---------- 7. под одеялом: сердце и часы ----------
hs, he = ev('hide_start')[0], ev('hide_end')[0]
tb, k = hs + 0.1, 0
while tb < he - 0.3:
    p = (tb - hs) / (he - hs); per = 1 / (1.25 + 0.75 * min(1, p * 1.2))
    add(heart(min(0.5, per)), tb, 0.55); tb += per
tb = hs + 0.4
while tb < he - 0.5:
    p = (tb - hs) / (he - hs); add(tick(), tb, 0.16, pan=-0.6); tb += 0.42 - 0.3 * np.sin(np.pi * p)
dd = he - hs; s = pad([note(36), note(42)], dd, 2.0, 0.5, 0.5) * np.linspace(0.3, 1, int(SR * dd))
add(s, hs, 0.045)
sh = bandf(noise(3.0), 150, 1200) * np.sin(np.pi * tt(3.0) / 3.0) ** 2
add(sh, hs + 1.0, 0.1, pan=0.6)

# ---------- 8. рассвет и облегчение ----------
t_bad = ev('msg_bad')[0]
C = 130.81
add(pad([C, C * 1.26, C * 1.498, C * 2], t_bad - t_dawn + 0.1, 1.0, 0.08), t_dawn, 0.17)
for i, tb in enumerate(np.arange(t_dawn + 0.2, t_bad - 0.1, 0.3)):
    add(bell(C * 2 * 2 ** ([0, 4, 7, 12, 16, 12, 7, 4][i % 8] / 12), 0.8), tb, 0.09, pan=(-0.4, 0.4)[i % 2])
for i in range(9): add(chirp(), t_dawn + 0.3 + i * 0.27 + rng.uniform(0, 0.1), 0.05, pan=rng.uniform(-0.8, 0.8))
for tp in ev('puff'): add(whoosh(0.8, 300, 2500), tp, 0.22)
for td in ev('ding'): add(ding(), td, 0.3); add(ding(1760), td + 0.12, 0.25)
for tm in ev('msg'): add(ding(987.8, 0.5), tm, 0.22); add(ding(1318.5, 0.5), tm + 0.08, 0.2)
for tl in ev('laugh'):
    for i, sm in enumerate([0, 4, 7, 12]): add(pluck(C * 4 * 2 ** (sm / 12), 0.4, 1.5), tl + 0.05 + i * 0.09, 0.14)
for ts in ev('sent'): add(whoosh(0.25, 800, 6000), ts, 0.2); add(ding(1568, 0.3), ts + 0.15, 0.12)
for ty in ev('typing'):
    for i in range(6): add(tick(0.03, 1500), ty + i * 0.12, 0.12)

# ---------- 9. финал ----------
add(ding(740, 0.9), t_bad, 0.3); add(ding(784, 0.9), t_bad + 0.07, 0.28)          # «неправильный» дзынь
add(thump(55, 0.7, 0.5, 0.2), t_bad + 0.05, 0.5)
t_fin = ev('final')[0]
tr0 = ev('riser')[0]
add(riser(t_fin - tr0), tr0, 0.11)
t_fr = ev('freeze')[0]
dd = t_fin - t_fr; t = tt(dd)
add(fade((np.sin(2 * np.pi * 49 * t) + 0.8 * np.sin(2 * np.pi * 51.9 * t) + 0.4 * np.sin(2 * np.pi * 98.5 * t) + 0.2 * np.sin(2 * np.pi * 197.5 * t)), 0.3, 0.02), t_fr, 0.075)
tb = t_fr + 0.1
while tb < t_fin - 0.3: add(heart(0.42), tb, 0.6); tb += 0.44
for tf in ev('flicker'):
    for i in range(7): add(tick(0.04, 900 + 200 * i), tf + i * 0.07, 0.3)
for tl in ev('lights_out2'): add(power_down(0.9), tl, 0.5); add(sting(1.2, 277), tl + 0.45, 0.14)
add(boom(2.8, 42), t_fin, 1.0); add(sting(2.2, 207), t_fin, 0.3); add(bandf(noise(1.5), 2500, 12000) * np.exp(-tt(1.5) * 3), t_fin, 0.2)
dd = DUR - t_fin; add(fade(np.sin(2 * np.pi * 55 * tt(dd)) + 0.6 * np.sin(2 * np.pi * 58.3 * tt(dd)), 0.4, 1.2), t_fin, 0.08)
for i, sm in enumerate([12, 13]): add(bell(note(36 + sm), 1.4), t_fin + 1.0 + i * 0.3, 0.06)

# ---------- сведение ----------
st = np.stack([mixL, mixR], 1)[:int(SR * DUR)]
st = np.tanh(st * 1.6) / np.tanh(1.6)
st *= 0.92 / np.max(np.abs(st))
n_out = int(0.4 * SR); st[-n_out:] *= np.linspace(1, 0, n_out)[:, None]
out = os.path.join(HERE, 'out', 'audio.wav')
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype('<i2').tobytes())
print('audio:', out, f'{DUR:.2f}s', 'rms', float(np.sqrt(np.mean(st ** 2))))
