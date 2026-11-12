"""Проверка озвучки распознавателем речи (faster-whisper): печатает реплики, которые распознаны неточно.
    WHISPER_MODEL=/папка/с/моделью python3 check_voice.py"""
import difflib, json, os, re, wave
import numpy as np
from faster_whisper import WhisperModel
HERE = os.path.dirname(os.path.abspath(__file__))
m = WhisperModel(os.environ['WHISPER_MODEL'], device='cpu', compute_type='int8', cpu_threads=int(os.environ.get('THREADS', '2')))
NUM = {'ноль': '0', 'два': '2', 'три': '3', 'пять': '5', 'шесть': '6', 'семь': '7', 'сорок': '40'}
def norm(s):
    s = re.sub(r'\s+', ' ', re.sub(r'[^а-я0-9 ]', ' ', s.lower().replace('ё', 'е'))).strip()
    return s.translate(str.maketrans('оеяэ', 'аиии'))
tl = json.load(open(os.path.join(HERE, 'timeline.json'), encoding='utf-8')); bad = []
for l in tl['lines']:
    with wave.open(os.path.join(HERE, 'voice', l['id'] + '.wav')) as w: sr = w.getframerate(); a = np.frombuffer(w.readframes(w.getnframes()), '<i2') / 32767
    n = int(len(a) * 16000 / sr); x = np.interp(np.arange(n) * sr / 16000, np.arange(len(a)), a).astype(np.float32)
    x = np.concatenate([np.zeros(4000, np.float32), x, np.zeros(4000, np.float32)])
    segs, _ = m.transcribe(x, language='ru', beam_size=3, condition_on_previous_text=False); got = ' '.join(s.text.strip() for s in segs)
    sc = difflib.SequenceMatcher(None, norm(l['text']), norm(got)).ratio()
    if sc < .86: bad.append(l['id']); print(f"{sc:.2f} {l['id']} {l['sp']} {l['d']:.1f}s\n   текст: {l['text']}\n   слышно: {got}", flush=True)
print('проверено', len(tl['lines']), 'неточных', len(bad)); print('IDS', ' '.join(bad))
