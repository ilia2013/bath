"""Озвучка: синтез реплик открытыми голосами Piper (ru_RU-dmitri и ru_RU-denis, лицензия CC0).
Пишет voice/<id>.wav, voice/durations.json и voice/durations.js (тайминг для film.js).

    pip install piper-tts numpy
    PIPER_VOICES=/папка/с/моделями python3 voice.py            # все реплики
    PIPER_VOICES=... python3 voice.py rule1 dawn                # только выбранные

Модели: https://huggingface.co/rhasspy/piper-voices/tree/main/ru/ru_RU (dmitri/medium и denis/medium).

Синтез каждый раз звучит немного по-разному. Если установлен faster-whisper и задана переменная
WHISPER_MODEL (папка с моделью), для каждой реплики делается до TAKES дублей и берётся тот,
который распознаватель речи слышит точнее всего.
"""
import difflib, json, os, re, sys, wave
import numpy as np
from piper import PiperVoice, SynthesisConfig

HERE = os.path.dirname(os.path.abspath(__file__))
VDIR = os.environ.get('PIPER_VOICES', os.path.join(HERE, 'voices'))
OUT = os.path.join(HERE, 'voice'); os.makedirs(OUT, exist_ok=True)
TEMPO = 1.1                        # больше — медленнее
TAKES = int(os.environ.get('TAKES', '8'))

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

def trim(a, sr, thr=0.012, pad=0.03):
    idx = np.where(np.abs(a) > thr)[0]
    if not len(idx): return a
    return a[max(0, idx[0] - int(pad * sr)): idx[-1] + int(pad * sr)]

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
        if who not in voices: voices[who] = PiperVoice.load(os.path.join(VDIR, f'ru_RU-{who}-medium.onnx'))
        best = None
        for _ in range(TAKES if check else 1):
            chunks = list(voices[who].synthesize(text, syn_config=SynthesisConfig(length_scale=TEMPO)))
            sr = chunks[0].sample_rate
            a = trim(np.concatenate([c.audio_float_array for c in chunks]), sr)
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
