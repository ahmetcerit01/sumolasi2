#!/usr/bin/env python3
"""Su ekleme geri bildirim seslerini sıfırdan sentezler (lisans derdi yok, tamamen bize ait).

Üç varyant:
  a  "Dolu bardak"   bardağa dökülen su (glug) + başarı çınlaması + küçük oda yankısı
  b  "Kristal damla" tok bir damla + yükselen kristal arpej (Do-Mi-Sol)
  c  "Sulu pop"      perdesi düşen sulu kabarcık pop'u + alttan tok vuruş + kısa yankı

Kullanım:
    python3 scripts/generate-water-sound.py          # üç varyantı da üretir
    python3 scripts/generate-water-sound.py b        # sadece b
    -> assets/sounds/water_add_<v>.wav (repoya eklenmez); ardından:
    afconvert -f m4af -d aac -b 128000 assets/sounds/water_add_b.wav assets/sounds/water_add.m4a
    (uygulamadaki ses: APP_VARIANT / APP_PEAK_DB)
"""
import math
import os
import random
import struct
import sys
import wave

RATE = 44100


class Track:
    def __init__(self, seconds):
        self.n = int(RATE * seconds)
        self.buf = [0.0] * self.n

    def add(self, idx, value):
        if 0 <= idx < self.n:
            self.buf[idx] += value

    # Perdesi f0 -> f1 (üstel) kayan, üstel sönümlenen ton. Damla, pop ve vuruşların temeli.
    def sweep(self, start, f0, f1, sweep, decay, gain, harmonics=((1, 1.0),), attack=0.003):
        s0 = int(start * RATE)
        phase = 0.0
        for i in range(int(decay * 8 * RATE)):
            t = i / RATE
            k = min(t / sweep, 1.0) if sweep > 0 else 1.0
            freq = f0 * (f1 / f0) ** k
            phase += 2 * math.pi * freq / RATE
            env = min(t / attack, 1.0) * math.exp(-t / decay)
            s = sum(a * math.sin(h * phase) for h, a in harmonics)
            self.add(s0 + i, gain * env * s)

    # Çan/kristal tınısı: uyumsuz kısmi titreşimlerle (bell partials) parlak ton
    def bell(self, start, freq, decay, gain):
        partials = [(1.0, 1.0, 1.0), (2.0, 0.35, 0.6), (2.76, 0.22, 0.45), (5.4, 0.08, 0.25)]
        s0 = int(start * RATE)
        for i in range(int(decay * 7 * RATE)):
            t = i / RATE
            v = 0.0
            for ratio, amp, dmul in partials:
                v += amp * math.sin(2 * math.pi * freq * ratio * t) * math.exp(-t / (decay * dmul))
            self.add(s0 + i, gain * min(t / 0.002, 1.0) * v)

    # Alçak geçirgen gürültü: sıçrama / dökülme dokusu
    def noise(self, start, length, gain, cutoff=0.12, seed=1):
        rnd = random.Random(seed)
        s0 = int(start * RATE)
        lp = 0.0
        for i in range(int(length * RATE)):
            t = i / RATE
            lp += cutoff * (rnd.uniform(-1, 1) - lp)
            env = min(t / 0.008, 1.0) * math.exp(-t / (length / 4))
            self.add(s0 + i, gain * env * lp)

    # Schroeder yankısı: 4 paralel comb + 2 seri allpass. Sese "oda" ve dolgunluk verir.
    def reverb(self, mix=0.25, room=0.78):
        dry = self.buf
        combs = [1557, 1617, 1491, 1422]
        wet = [0.0] * self.n
        for d in combs:
            line = [0.0] * d
            p = 0
            for i in range(self.n):
                y = line[p]
                line[p] = dry[i] + y * room
                wet[i] += y
                p = (p + 1) % d
        for d, g in ((225, 0.5), (556, 0.5)):
            line = [0.0] * d
            p = 0
            for i in range(self.n):
                b = line[p]
                x = wet[i]
                y = -g * x + b
                line[p] = x + g * y
                wet[i] = y
                p = (p + 1) % d
        self.buf = [d_ + mix * w / len(combs) for d_, w in zip(dry, wet)]

    def write(self, path, peak_db=-1.0, fade=0.06):
        peak = max(abs(x) for x in self.buf) or 1.0
        target = 10 ** (peak_db / 20)
        fade_n = int(fade * RATE)
        out = []
        for i, x in enumerate(self.buf):
            y = x / peak * target
            if i > self.n - fade_n:
                y *= (self.n - i) / fade_n
            out.append(int(max(-1.0, min(1.0, y)) * 32767))
        with wave.open(path, 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(RATE)
            w.writeframes(struct.pack('<%dh' % len(out), *out))
        print('wrote', os.path.normpath(path))


WARM = ((1, 1.0), (2, 0.25), (3, 0.08))  # sinüse biraz "gövde" katan harmonikler


def variant_a():
    """Dolu bardak: dökülen suyun 'gluk gluk'u, ardından başarı çınlaması."""
    tr = Track(1.1)
    # bardak doldukça perde yükselir: her gluk bir öncekinden biraz daha tiz
    for k, (st, f) in enumerate([(0.00, 210), (0.075, 260), (0.14, 330), (0.20, 420)]):
        tr.sweep(st, f * 0.8, f * 1.9, sweep=0.035, decay=0.028, gain=0.75 - k * 0.08, harmonics=WARM)
    tr.noise(0.0, 0.32, gain=0.22, cutoff=0.18, seed=3)
    # başarı çınlaması (Mi6 + Si6, beşli aralık = olumlu his)
    tr.bell(0.22, 1318.5, decay=0.18, gain=0.32)
    tr.bell(0.27, 1975.5, decay=0.16, gain=0.22)
    tr.reverb(mix=0.35, room=0.80)
    return tr


def variant_b():
    """Kristal damla: tok damla + Do-Mi-Sol yükselen arpej."""
    tr = Track(1.2)
    # tok, dolgun ana damla (alt frekanstan başlar → gövdeli)
    tr.sweep(0.0, 260, 1150, sweep=0.05, decay=0.045, gain=1.0, harmonics=WARM)
    tr.sweep(0.0, 90, 70, sweep=0.06, decay=0.05, gain=0.45)  # alttan hafif tokluk
    tr.noise(0.01, 0.22, gain=0.18, cutoff=0.15, seed=5)
    # yükselen majör arpej: Do6, Mi6, Sol6
    for st, f, g in [(0.10, 1046.5, 0.30), (0.16, 1318.5, 0.27), (0.22, 1568.0, 0.25)]:
        tr.bell(st, f, decay=0.20, gain=g)
    tr.reverb(mix=0.30, room=0.82)
    return tr


def variant_c():
    """Sulu pop: perdesi düşen kabarcık pop'u + tok vuruş + küçük kabarcıklar."""
    tr = Track(0.9)
    # pop: yüksekten hızla aşağı inen perde (balon patlaması / 'blop')
    tr.sweep(0.0, 900, 280, sweep=0.06, decay=0.05, gain=1.0, harmonics=WARM, attack=0.0015)
    # alttan tok vuruş (dokunmatik geri bildirim hissi)
    tr.sweep(0.0, 140, 55, sweep=0.08, decay=0.06, gain=0.7)
    tr.noise(0.0, 0.08, gain=0.25, cutoff=0.35, seed=9)  # pop'un 'ıslak' tıkı
    # ardından yükselen küçük kabarcıklar
    for st, f in [(0.11, 900), (0.16, 1250), (0.21, 1600), (0.25, 2000)]:
        tr.sweep(st, f * 0.6, f, sweep=0.015, decay=0.012, gain=0.22, harmonics=WARM)
    tr.reverb(mix=0.22, room=0.75)
    return tr


VARIANTS = {'a': variant_a, 'b': variant_b, 'c': variant_c}

# Uygulamada kullanılan ses: B, tepe -7 dBFS (ilk denemeden ~6 dB kısık)
APP_VARIANT = 'b'
APP_PEAK_DB = -7.0

if __name__ == '__main__':
    chosen = sys.argv[1:] or list(VARIANTS)
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')
    for v in chosen:
        peak_db = APP_PEAK_DB if v == APP_VARIANT else -1.0
        VARIANTS[v]().write(os.path.join(out_dir, f'water_add_{v}.wav'), peak_db=peak_db)
