"""Звук длинного ролика: атмосфера, музыка, эффекты (всё синтезируется кодом) + голоса с приглушением музыки под речью.
Читает timeline.json и voice/*.wav, пишет out/audio.wav."""
import json, os, wave
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
tl = json.load(open(os.path.join(HERE, 'timeline.json'), encoding='utf-8'))
SR = 44100; DUR = tl['dur']; N = int(SR * DUR) + SR
f32 = np.float32
bed = np.zeros((N, 2), f32); rng = np.random.default_rng(11)
def tt(d): return np.arange(int(SR * d), dtype=f32) / SR
def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N or i < 0: return
    sig = sig[:N - i].astype(f32); l, r = np.cos((pan + 1) * np.pi / 4) * 1.414, np.sin((pan + 1) * np.pi / 4) * 1.414
    bed[i:i + len(sig), 0] += sig * gain * l; bed[i:i + len(sig), 1] += sig * gain * r
def fade(s, a=.01, r=.05):
    n = len(s); e = np.ones(n, f32); na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return s * e
def noise(d): return rng.standard_normal(int(SR * d)).astype(f32)
def bandf(s, lo, hi):
    S = np.fft.rfft(s); f = np.fft.rfftfreq(len(s), 1 / SR)
    return np.fft.irfft(S * (1 / (1 + (f / max(hi, 1)) ** 6) * (1 - 1 / (1 + (f / max(lo, 1)) ** 6))), len(s)).astype(f32)
def smooth(x, k):
    cs = np.cumsum(np.concatenate([np.zeros(k, f32), x, np.zeros(k, f32)]), dtype=np.float64)
    return ((cs[2 * k:] - cs[:-2 * k]) / (2 * k)).astype(f32)[:len(x)]
# ---------- инструменты ----------
def thump(f=85, d=.4, drop=.55, click=.5):
    t = tt(d); ph = 2 * np.pi * np.cumsum(f * (drop + (1 - drop) * np.exp(-t * 18))) / SR
    return fade((np.sin(ph) + .45 * np.sin(2 * ph) + .25 * np.sin(3 * ph)) * np.exp(-t * 11) + bandf(noise(d), 300, 2500) * np.exp(-t * 60) * click, .002, .05)
def boom(d=2.2, f=46):
    t = tt(d); return fade(np.sin(2 * np.pi * np.cumsum(f * (.6 + .4 * np.exp(-t * 6))) / SR) * np.exp(-t * 2.2) + bandf(noise(d), 30, 500) * np.exp(-t * 5) * .8, .002, .3)
def whoosh(d=.5, lo=400, hi=5000): t = tt(d); return bandf(noise(d), lo, hi) * np.sin(np.pi * t / d) ** 2
def ding(f=1318.5, d=.9): t = tt(d); return fade((np.sin(2 * np.pi * f * t) + .5 * np.sin(2 * np.pi * f * 1.5 * t) + .2 * np.sin(2 * np.pi * f * 2.01 * t)) * np.exp(-t * 6), .003, .05)
def bell(f, d=1.2): t = tt(d); return fade((np.sin(2 * np.pi * f * t) + .35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 6)) * np.exp(-t * 3.2), .004, .05)
def pluck(f, d=.5, bright=3.0): t = tt(d); return fade(sum(np.sin(2 * np.pi * f * k * t) / k ** 1.4 * np.exp(-t * (3 + k * bright)) for k in range(1, 7)), .003, .03)
def sting(d=1.3, base=233.0):
    t = tt(d); s = sum(np.sign(np.sin(2 * np.pi * f * t)) * .4 + np.sin(2 * np.pi * f * t) for f in (base, base * 1.06, base * 1.414, base * 2.12, base * 2.98))
    return fade(bandf(s.astype(f32), 150, 3800) * np.exp(-t * 2.6) / 5, .004, .2)
def power_down(d=1.0): t = tt(d); ph = np.cumsum(420 * np.exp(-t * 4.2) + 28) / SR * 2 * np.pi; return fade((np.sin(ph) + .5 * np.sin(2 * ph) + .3 * np.sin(3 * ph)) * (1 - t / d) ** .6, .003, .1)
def tick(d=.05, f=2400): t = tt(d); return (np.sin(2 * np.pi * f * t) + bandf(noise(d), 1500, 7000) * .6) * np.exp(-t * 140)
def chirp(d=.14): t = tt(d); f = 3200 + 1500 * np.sin(np.pi * t / d) + rng.uniform(-300, 300); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 2
def ring(d=.5, f=880): t = tt(d); return fade((np.sin(2 * np.pi * f * t) + .6 * np.sin(2 * np.pi * f * 1.26 * t)) * (.5 + .5 * np.sign(np.sin(2 * np.pi * 22 * t))), .005, .03)
def riser(d): t = tt(d); k = t / d; ph = 2 * np.pi * np.cumsum(90 + 800 * k ** 2.2) / SR; return (np.sin(ph) * .5 + bandf(noise(d), 500, 6000) * .6) * k ** 2
# ---------- подложки на всю длину ----------
t = np.arange(N, dtype=f32) / SR
drone = ((np.sin(2 * np.pi * 55 * t) + .7 * np.sin(2 * np.pi * 55.6 * t) + .5 * np.sin(2 * np.pi * 82.4 * t) + .25 * np.sin(2 * np.pi * 110.3 * t) + .12 * np.sin(2 * np.pi * 165.2 * t)) * (.75 + .25 * np.sin(2 * np.pi * .19 * t))).astype(f32)
w = bandf(noise(30), 200, 900); wind = (np.tile(w, N // len(w) + 1)[:N] * (.5 + .5 * np.sin(2 * np.pi * .07 * t))).astype(f32)
hall = bandf(noise(30), 80, 600); hall = np.tile(hall, N // len(hall) + 1)[:N]
C = 130.81
warm = sum(np.sin(2 * np.pi * (C * m + dt) * t) for m in (1, 1.26, 1.498, 2) for dt in (-.35, .35)).astype(f32) / 4
dark_g = np.zeros(N, f32); lit_g = np.zeros(N, f32); day_g = np.zeros(N, f32); tense_g = np.zeros(N, f32)
chap_of = lambda T: max([c['n'] for c in tl['chapters'] if c['t'] <= T] or [0])
for sh in tl['shots']:
    a, b = int(sh['t0'] * SR), int((sh['t0'] + sh['d']) * SR); A = set(sh['A']); sc = sh['scene']
    if sc in ('chapter', 'title', 'final', 'outro'): continue
    if 'day' in A or 'memorial' in A or 'reflect' in A or (sc == 'phone' and sh['K'].get('calls')): day_g[a:b] = 1
    elif 'lit' in A or 'crowd' in A or 'tray' in A: lit_g[a:b] = 1
    else: dark_g[a:b] = 1
    if chap_of(sh['t0']) in (11, 12) and sc != 'chapter': tense_g[a:b] = 1
k = int(.6 * SR); dark_g, lit_g, day_g, tense_g = smooth(dark_g, k), smooth(lit_g, k), smooth(day_g, k), smooth(tense_g, k)
for ch in (0, 1):
    bed[:, ch] += drone * dark_g * .075 + wind * dark_g * .045 + hall * dark_g * .03 + warm * day_g * .11
# мелодии: тревожный пульс в темноте, «магазинная» музыка при свете, спокойные колокольчики утром
A1 = 55.0; note = lambda s, base=A1: base * 2 ** (s / 12)
arp_d = [0, 3, 7, 12, 7, 3, 1, 3]; arp_l = [0, 4, 7, 12, 16, 12, 7, 4, 5, 9, 12, 17, 12, 9, 7, 2]
tb, kk = 0.0, 0
while tb < DUR:
    i = int(tb * SR); dg, lg, yg, tg = dark_g[i], lit_g[i], day_g[i], tense_g[i]
    if dg > .3:
        step = .3 if tg > .5 else .6
        if kk % 2 == 0: add(pluck(A1 * (1 if (kk // 8) % 4 != 3 else 2 ** (-2 / 12)), .5, 2.0), tb, .17 * dg * (1.3 if tg > .5 else 1))
        add(bell(note(24 + arp_d[kk % 8]), .7), tb, .028 * dg * (1.6 if tg > .5 else 1), pan=(-.5, .5)[kk % 2])
    elif lg > .3:
        step = .22; add(pluck(C * 2 * 2 ** (arp_l[kk % 16] / 12), .3, 1.2), tb, .07 * lg, pan=(-.4, .4)[kk % 2])
        if kk % 4 == 0: add(pluck(C / 2 * 2 ** ([0, 5, 7, 0][(kk // 4) % 4] / 12), .4, 2.0), tb, .12 * lg)
    elif yg > .3:
        step = .34; add(bell(C * 2 * 2 ** ([0, 4, 7, 12, 16, 12, 7, 4][kk % 8] / 12), .9), tb, .06 * yg, pan=(-.4, .4)[kk % 2])
        if kk % 5 == 0: add(chirp(), tb + rng.uniform(0, .2), .04, pan=rng.uniform(-.8, .8))
    else: step = .5
    tb += step; kk += 1
# ---------- эффекты по шотам ----------
for sh in tl['shots']:
    T0, d = sh['t0'], sh['d']
    for fx in sh['fx']:
        if fx == 'chapter': add(whoosh(.4), T0, .3); add(boom(1.8), T0 + .1, .6); add(sting(.6, 440), T0 + .1, .08)
        elif fx == 'boom': add(boom(2.8, 42), T0 + .1, 1.0); add(sting(2.0, 207), T0 + .1, .28)
        elif fx == 'sting': add(sting(1.4, 233), T0, .3); add(thump(60, .5, .5, .6), T0, .55)
        elif fx in ('knock', 'knockback'):
            for q in ([.3, .75, 1.2] if fx == 'knock' else [1.2, 1.65, 2.1]): add(thump(95 if fx == 'knock' else 70, .35, .6, 1.2), T0 + q, .8, pan=-.3 if fx == 'knock' else .4)
        elif fx == 'crash': add(bandf(noise(1.2), 200, 6000) * np.exp(-tt(1.2) * 5), T0, .6); add(boom(1.2, 60), T0, .7)
        elif fx in ('thud', 'grab'): add(thump(70, .45, .5, .8), T0, .8)
        elif fx == 'ding': add(ding(1568, 1.2), T0 + .1, .3); add(ding(1174, 1.4), T0 + .35, .26)
        elif fx == 'ding3':
            for q in (.5, 1.6, 2.7): add(ding(1568, 1.0), T0 + q, .26); add(ding(1174, 1.2), T0 + q + .25, .22)
        elif fx == 'click': add(tick(.06, 1800), T0, .6); add(bandf(noise(.6), 2000, 8000) * np.exp(-tt(.6) * 8), T0 + .05, .12)
        elif fx == 'flicker':
            for q in np.arange(0, min(d, 6), .23): add(tick(.04, 900 + 300 * rng.random()), T0 + q, .22)
        elif fx == 'wake': add(riser(1.4), T0, .16)
        elif fx == 'alarm':
            dd = min(d, 14); tq = tt(dd); s = np.sign(np.sin(2 * np.pi * (700 + 300 * np.sign(np.sin(2 * np.pi * 2.2 * tq))) * tq)) * .5
            add(fade(bandf(s.astype(f32), 400, 3500), .05, .3), T0, .16, pan=-.5); add(fade(bandf(np.roll(s, 9000).astype(f32), 400, 3500), .05, .3), T0, .13, pan=.6)
        elif fx == 'rumble': dd = min(d, 12); add(fade(bandf(noise(dd), 30, 160), .5, .8), T0, .5)
        elif fx == 'beep':
            for q in (0, .25, .5): add(ding(1975, .18), T0 + q, .28)
        elif fx == 'rattle':
            for q in np.arange(0, min(d, 9), .31): add(tick(.05, 3100), T0 + q, .2, pan=.5); add(bandf(noise(.2), 800, 3000) * np.exp(-tt(.2) * 20), T0 + q, .1, pan=.5)
        elif fx == 'ring':
            for q in np.arange(.2, min(d, 9), 1.1): add(ring(.55, 1320), T0 + q, .2 + .03 * q)
        elif fx == 'scrape':
            for q in np.arange(.4, min(d, 10), 1.3): add(whoosh(.8, 2500, 9000), T0 + q, .28, pan=np.sin(q))
        elif fx == 'run':
            for n_, q in enumerate(np.arange(0, min(d, 12), .27)): add(thump(110, .12, .7, 1.0), T0 + q, .3, pan=(-.3, .3)[n_ % 2])
        elif fx == 'blast': add(boom(2.5, 50), T0, 1.0); add(bandf(noise(1.5), 2000, 12000) * np.exp(-tt(1.5) * 3), T0, .3)
        elif fx == 'bell_long': add(fade(ring(3.0, 990), .02, .3), T0 + .3, .3)
        elif fx == 'bell3':
            for q in (.4, .95, 1.5): add(ring(.32, 990), T0 + q, .34)
        elif fx == 'buzz':
            for q in (.2, .9): tq = tt(.5); add(fade(np.sign(np.sin(2 * np.pi * 160 * tq)) * .4, .01, .05), T0 + q, .18)
        elif fx == 'morning':
            for q in np.arange(.2, min(d, 8), .35): add(chirp(), T0 + q + rng.uniform(0, .15), .07, pan=rng.uniform(-.8, .8))
        elif fx == 'projector':
            for q in np.arange(0, min(d, 14), .09): add(tick(.02, 600), T0 + q, .08)
        elif fx == 'tick':
            for q in np.arange(0, min(d, 14), 1.0): add(tick(.05, 2200), T0 + q, .3)
        elif fx == 'lightsout': add(power_down(1.0), T0, .5)
        elif fx == 'muzak': pass
# ---------- голоса ----------
vo = np.zeros(N, f32)
def reverb(a, d=.35, wet=.3):
    ir = rng.standard_normal(int(SR * d)).astype(f32) * np.exp(-tt(d) * 14); ir /= np.sqrt(np.sum(ir ** 2))
    return np.concatenate([a, np.zeros(len(ir) - 1, f32)]) + wet * np.convolve(a, ir).astype(f32)
for l in tl['lines']:
    with wave.open(os.path.join(HERE, 'voice', l['id'] + '.wav')) as w_: a = (np.frombuffer(w_.readframes(w_.getnframes()), '<i2') / 32767).astype(f32)
    if l['sp'] == 'R': a = reverb(np.tanh(bandf(a, 350, 3400) * 2.0) * .8, .5, .35)       # голос из динамиков
    elif l['sp'] == 'D': a = reverb(a, .5, .3)
    elif l['sp'] == 'N': a = a * 1.0
    a = fade(a, .005, .02); i = int(l['t0'] * SR); a = a[:N - i]; vo[i:i + len(a)] += a
# ---------- сведение ----------
bed = np.tanh(bed * 1.5) / np.tanh(1.5) * .5
env = np.clip(smooth(np.abs(vo), int(.06 * SR)) / .05, 0, 1); env = smooth(env, int(.14 * SR))
bed *= (1 - .7 * env)[:, None]
st = (bed + vo[:, None] * .95)[:int(SR * DUR)]
st = np.tanh(st * 1.15) / np.tanh(1.15); st *= .94 / np.max(np.abs(st)); n_out = int(.8 * SR); st[-n_out:] *= np.linspace(1, 0, n_out, dtype=f32)[:, None]
with wave.open(os.path.join(HERE, 'out', 'audio.wav'), 'wb') as w_:
    w_.setnchannels(2); w_.setsampwidth(2); w_.setframerate(SR); w_.writeframes((st * 32767).astype('<i2').tobytes())
print(f'audio: {DUR/60:.2f} мин, rms {float(np.sqrt(np.mean(st ** 2))):.3f}')
