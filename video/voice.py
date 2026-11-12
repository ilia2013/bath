"""Озвучка реплик. Пишет voice/<id>.wav, voice/durations.json и voice/durations.js (тайминг для film.js).

Движок по умолчанию — нейросетевые голоса Microsoft Edge (edge-tts, нужен интернет):
    pip install edge-tts numpy
    python3 voice.py                        # все реплики
    python3 voice.py rule1 dawn             # только выбранные

Запасной движок — офлайн-голоса Piper (звучат «роботом», но лицензия CC0):
    pip install piper-tts numpy
    ENGINE=piper PIPER_VOICES=/папка/с/моделями python3 voice.py
    PIPER_VOICES=/папка/с/моделями python3 voice.py            # все реплики
    PIPER_VOICES=... python3 voice.py rule1 dawn                # только выбранные

Модели: https://huggingface.co/rhasspy/piper-voices/tree/main/ru/ru_RU (dmitri/medium и denis/medium).

Синтез каждый раз звучит немного по-разному. Если установлен faster-whisper и задана переменная
WHISPER_MODEL (папка с моделью), для каждой реплики делается до TAKES дублей и берётся тот,
который распознаватель речи слышит точнее всего.
"""
import difflib, json, os, re, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
VDIR = os.environ.get('PIPER_VOICES', os.path.join(HERE, 'voices'))
OUT = os.path.join(HERE, 'voice'); os.makedirs(OUT, exist_ok=True)
TEMPO = 1.1                        # больше — медленнее
TAKES = int(os.environ.get('TAKES', '8'))
ENGINE = os.environ.get('ENGINE', 'edge')

# Edge: голос, скорость, высота. Рассказчик — ниже и медленнее, сосед — выше и бодрее.
EDGE = {'dmitri': ('ru-RU-DmitryNeural', '-8%', '-6Hz'), 'denis': ('ru-RU-DmitryNeural', '+6%', '+14Hz')}

def edge_synth(text, who, rate=None, pitch=None):
    import asyncio, subprocess, tempfile, edge_tts
    voice, r0, p0 = EDGE[who]
    rate, pitch = rate or r0, pitch or p0
    async def run():
        buf = b''
        async for ch in edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, proxy=os.environ.get('HTTPS_PROXY')).stream():
            if ch['type'] == 'audio': buf += ch['data']
        return buf
    import time
    for attempt in range(12):
        try:
            mp3 = asyncio.run(run())
            if mp3: break
        except edge_tts.exceptions.NoAudioReceived:
            pass
        time.sleep(1.5 + attempt)
    else:
        raise RuntimeError('edge-tts: нет ответа для: ' + text)
    with tempfile.NamedTemporaryFile(suffix='.mp3') as f:
        f.write(mp3); f.flush()
        raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f.name, '-f', 's16le', '-ac', '1', '-ar', '24000', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, '<i2') / 32767, 24000

N, S = 'dmitri', 'denis'           # рассказчик и сосед
LINES = [
    ('city1', N, 'Двадцать три сорок семь. Обычный вечер.'),
    ('city2', N, 'И вдруг во всём городе гаснет свет.'),
    ('room1', N, 'Сеть пропала. Интернета нет.'),
    ('room2', N, 'А ровно через минуту в твою дверь стучат.'),
    ('title', N, 'Как пережить ночь без света? Запомни три правила.'),
    ('rule1', N, 'Правило первое. Не открывай дверь.'),
    ('door1', N, 'За дверью голос.'),
    ('door_n', S, 'Сосед, это я. Одолжи свечку.'),
    ('door2', N, 'Точь-в-точь как у соседа.'),
    ('peep1', N, 'Вот только сосед'),
    ('peep2', N, 'уехал неделю назад.'),
    ('rule2', N, 'Правило второе. Не свети в окно.'),
    ('win1', N, 'В доме напротив ни одного огня.'),
    ('win2', N, 'Но стоит включить фонарик,'),
    ('win3', N, 'и все они смотрят на тебя.'),
    ('rule3', N, 'Правило третье. Ни звука до утра.'),
    ('hide1', N, 'Они не видят в темноте.'),
    ('hide2', N, 'Они слушают.'),
    ('hide3', N, 'Просто сиди. И жди рассвета.'),
    ('dawn', N, 'Шесть утра. Свет вернулся.'),
    ('relief1', N, 'Ты пережил эту ночь.'),
    ('relief2', N, 'Наверное.'),
    ('msg1', S, 'Здорово! Я вчера вечером вернулся.'),
    ('msg2', S, 'Свет вырубили, стучал к тебе за свечкой.'),
    ('msg3', S, 'Ты чего не открыл?'),
    ('laugh', N, 'Так это и правда был сосед!'),
    ('msg4', S, 'Кстати. А кто стоял у тебя за спиной, когда ты светил в окно?'),
    ('rule4', N, 'Правило четвёртое. Не оборачивайся.'),
]


# Режиссура для edge: реплика -> фразы (текст, скорость, высота, громкость, пауза после, сек).
# Разная высота и темп у соседних фраз дают интонацию, паузы — драматизм.
D = {
 'city1': [('Двадцать три сорок семь.', '-8%', '-2Hz', 1.0, .35), ('Обычный вечер.', '-14%', '-9Hz', .85, 0)],
 'city2': [('И вдруг…', '-16%', '+10Hz', 1.0, .3), ('во всём городе гаснет свет!', '+4%', '+4Hz', 1.0, 0)],
 'room1': [('Сеть пропала.', '-2%', '+4Hz', 1.0, .2), ('Интернета нет.', '-10%', '-6Hz', .9, 0)],
 'room2': [('А ровно через минуту…', '-10%', '-2Hz', 1.0, .45), ('в твою дверь стучат.', '-22%', '-15Hz', .75, 0)],
 'title': [('Как пережить ночь без света?', '+6%', '+12Hz', 1.0, .25), ('Запомни три правила!', '+2%', '+5Hz', 1.0, 0)],
 'rule1': [('Правило первое:', '+2%', '+9Hz', 1.0, .2), ('не открывай дверь!', '-6%', '-3Hz', 1.0, 0)],
 'door1': [('За дверью —', '-10%', '-4Hz', 1.0, .2), ('голос.', '-16%', '-12Hz', .85, 0)],
 'door_n': [('Сосе-ед… это я.', '-20%', '+16Hz', 1.0, .35), ('Одолжи свечку…', '-24%', '+8Hz', .9, 0)],
 'door2': [('Точь-в-точь как у соседа.', '-6%', '+2Hz', 1.0, 0)],
 'peep1': [('Вот только сосед…', '-14%', '+5Hz', 1.0, 0)],
 'peep2': [('уехал неделю назад.', '-24%', '-17Hz', .8, 0)],
 'rule2': [('Правило второе:', '+2%', '+9Hz', 1.0, .2), ('не свети в окно!', '-6%', '-3Hz', 1.0, 0)],
 'win1': [('В доме напротив —', '-8%', '-2Hz', 1.0, .15), ('ни одного огня.', '-14%', '-10Hz', .9, 0)],
 'win2': [('Но стоит включить фонарик…', '-4%', '+9Hz', 1.0, 0)],
 'win3': [('и все они…', '-14%', '-4Hz', 1.0, .3), ('смотрят на тебя.', '-24%', '-16Hz', .8, 0)],
 'rule3': [('Правило третье:', '+2%', '+9Hz', 1.0, .2), ('ни звука до утра!', '-6%', '-3Hz', 1.0, 0)],
 'hide1': [('Они не видят в темноте.', '-12%', '-6Hz', .95, 0)],
 'hide2': [('Они…', '-18%', '-8Hz', .85, .3), ('слушают.', '-26%', '-16Hz', .7, 0)],
 'hide3': [('Просто сиди.', '-12%', '-4Hz', .9, .3), ('И жди рассвета.', '-18%', '-10Hz', .85, 0)],
 'dawn': [('Шесть утра!', '+6%', '+14Hz', 1.0, .25), ('Свет вернулся!', '+4%', '+10Hz', 1.0, 0)],
 'relief1': [('Ты пережил эту ночь!', '+4%', '+11Hz', 1.0, 0)],
 'relief2': [('…наверное.', '-26%', '-15Hz', .75, 0)],
 'msg1': [('Здорово!', '+8%', '+18Hz', 1.0, .2), ('Я вчера вечером вернулся.', '+4%', '+13Hz', 1.0, 0)],
 'msg2': [('Свет вырубили —', '+4%', '+15Hz', 1.0, .15), ('стучал к тебе за свечкой.', '+2%', '+11Hz', 1.0, 0)],
 'msg3': [('Ты чего не открыл?', '+2%', '+19Hz', 1.0, 0)],
 'laugh': [('Ха!', '+0%', '+16Hz', 1.0, .15), ('Так это и правда был сосед!', '+8%', '+12Hz', 1.0, 0)],
 'msg4': [('Кстати…', '-10%', '+12Hz', 1.0, .45), ('а кто стоял у тебя за спиной,', '-14%', '+5Hz', .95, .15), ('когда ты светил в окно?', '-18%', '+0Hz', .85, 0)],
 'rule4': [('Правило четвёртое…', '-14%', '-6Hz', 1.0, .55), ('Не оборачивайся.', '-28%', '-19Hz', .8, 0)],
}

def edge_directed(lid, who):
    voice = EDGE[who][0]; out = []; sr = 24000
    for text, rate, pitch, gain, pause in D[lid]:
        a, sr = edge_synth(text, who, rate, pitch)
        a = squeeze(trim(a, sr), sr, keep=0.22)
        out += [a / max(1e-6, np.max(np.abs(a))) * gain, np.zeros(int(pause * sr))]
    return np.concatenate(out), sr

def trim(a, sr, thr=0.012, pad=0.03):
    idx = np.where(np.abs(a) > thr)[0]
    if not len(idx): return a
    return a[max(0, idx[0] - int(pad * sr)): idx[-1] + int(pad * sr)]

def squeeze(a, sr, thr=0.015, keep=0.28):
    """Укорачивает паузы внутри реплики до keep секунд."""
    w = int(0.02 * sr); e = np.convolve(np.abs(a), np.ones(w) / w, 'same') > thr
    out, i, n = [], 0, len(a)
    while i < n:
        j = i
        while j < n and e[j] == e[i]: j += 1
        seg = a[i:j]
        if not e[i] and len(seg) > keep * sr:
            h = int(keep * sr / 2); seg = np.concatenate([seg[:h], seg[-h:]])
        out.append(seg); i = j
    return np.concatenate(out)

def norm(s):
    """Грубая нормализация для сравнения с распознанным текстом (без цифр, пунктуации и безударных о/а, е/и)."""
    s = s.lower().replace('ё', 'е')
    for a, b in (('23.47', 'двадцать три сорок семь'), ('23-47', 'двадцать три сорок семь'), ('23:47', 'двадцать три сорок семь'), ('6 ', 'шесть ')):
        s = s.replace(a, b)
    s = re.sub(r'\s+', ' ', re.sub(r'[^а-я ]', ' ', s)).strip()
    return s.translate(str.maketrans('оеяэ', 'аиии'))

_asr = None
def recognize(a, sr):
    global _asr
    if _asr is None:
        from faster_whisper import WhisperModel
        _asr = WhisperModel(os.environ['WHISPER_MODEL'], device='cpu', compute_type='int8')
    n = int(len(a) * 16000 / sr)
    x = np.interp(np.arange(n) * sr / 16000, np.arange(len(a)), a).astype(np.float32)
    x = np.concatenate([np.zeros(4000, np.float32), x, np.zeros(4000, np.float32)])
    segs, _ = _asr.transcribe(x, language='ru', beam_size=5, condition_on_previous_text=False)
    return ' '.join(s.text.strip() for s in segs)

def save(lid, a, sr):
    a = a / max(1e-6, np.max(np.abs(a))) * 0.9
    with wave.open(os.path.join(OUT, lid + '.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((a * 32767).astype('<i2').tobytes())
    return round(len(a) / sr, 3)

def write_durations(durs):
    json.dump(durs, open(os.path.join(OUT, 'durations.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open(os.path.join(OUT, 'durations.js'), 'w', encoding='utf-8').write('window.VOICE_DUR = ' + json.dumps(durs) + ';\n')

def main(only=None):
    check = bool(os.environ.get('WHISPER_MODEL'))
    voices, durs = {}, {}
    dpath = os.path.join(OUT, 'durations.json')
    if os.path.exists(dpath): durs = json.load(open(dpath, encoding='utf-8'))
    for lid, who, text in LINES:
        if only and lid not in only: continue
        if ENGINE == 'piper' and who not in voices:
            from piper import PiperVoice
            voices[who] = PiperVoice.load(os.path.join(VDIR, f'ru_RU-{who}-medium.onnx'))
        best = None
        for _ in range(TAKES if (check and ENGINE == 'piper') else 1):
            if ENGINE == 'piper':
                from piper import SynthesisConfig
                chunks = list(voices[who].synthesize(text, syn_config=SynthesisConfig(length_scale=TEMPO)))
                sr = chunks[0].sample_rate
                a = trim(np.concatenate([c.audio_float_array for c in chunks]), sr)
            else:
                a, sr = edge_directed(lid, who) if lid in D else edge_synth(text, who)
                if lid not in D: a = squeeze(trim(a, sr), sr)
            got = recognize(a, sr) if check else ''
            score = difflib.SequenceMatcher(None, norm(text), norm(got)).ratio() if check else 1.0
            if best is None or score > best[0]: best = (score, a, sr, got)
            if score >= 0.999: break
        durs[lid] = save(lid, best[1], best[2])
        print(f'{lid:8s} {who:6s} {durs[lid]:5.2f}s  {best[0]:.2f}  {best[3] or text}', flush=True)
    write_durations(durs)
    print('итого речи:', round(sum(durs.values()), 1), 'с')

if __name__ == '__main__':
    main(set(sys.argv[1:]) or None)
