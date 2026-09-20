import { EventBus } from "../core/EventBus";
import type { GameEventMap } from "../core/GameEvents";
import type { GameSettings } from "../save/SaveSystem";

/**
 * Fully procedural (Web Audio oscillators/noise) so the vertical slice needs
 * no external sound assets. Owns three buses - master -> {music, sfx} - and
 * reacts to noise/AI-state/capture events to build tension without a single
 * jump-scare sample.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private droneGain: GainNode | null = null;
  private chasePulseInterval: number | null = null;
  private settings: GameSettings;
  private started = false;

  constructor(
    private readonly bus: EventBus<GameEventMap>,
    settings: GameSettings,
  ) {
    this.settings = settings;
    bus.on("noise", (e) => this.playNoiseTick(e.sourceTag));
    bus.on("ai-state-changed", ({ state }) => this.onAIStateChanged(state));
    bus.on("player-spotted", () => this.playStinger());
    bus.on("player-caught", () => this.playCaughtSting());
    bus.on("door-state-changed", () => this.playDoorCreak());
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
    this.applySettings(this.settings);
    this.startAmbientDrone();
  }

  applySettings(settings: GameSettings): void {
    this.settings = settings;
    if (!this.ctx) return;
    this.masterGain.gain.value = settings.masterVolume;
    this.musicGain.gain.value = settings.musicVolume;
    this.sfxGain.gain.value = settings.sfxVolume;
  }

  setNightIntensity(nightFactor: number): void {
    if (!this.droneFilter) return;
    // Darker/eerier low-pass at night, brighter (less oppressive) by day.
    const cutoff = 220 + (1 - nightFactor) * 500;
    this.droneFilter.frequency.setTargetAtTime(cutoff, this.ctx!.currentTime, 1.5);
  }

  private startAmbientDrone(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    this.droneOsc1 = ctx.createOscillator();
    this.droneOsc2 = ctx.createOscillator();
    this.droneOsc1.type = "sine";
    this.droneOsc2.type = "sine";
    this.droneOsc1.frequency.value = 55;
    this.droneOsc2.frequency.value = 55 * 1.008; // slight beating for unease
    this.droneFilter = ctx.createBiquadFilter();
    this.droneFilter.type = "lowpass";
    this.droneFilter.frequency.value = 300;
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.18;

    this.droneOsc1.connect(this.droneFilter);
    this.droneOsc2.connect(this.droneFilter);
    this.droneFilter.connect(this.droneGain);
    this.droneGain.connect(this.musicGain);
    this.droneOsc1.start();
    this.droneOsc2.start();
  }

  private onAIStateChanged(state: string): void {
    if (!this.ctx || !this.droneGain) return;
    const now = this.ctx.currentTime;
    if (state === "CHASE") {
      this.droneGain.gain.setTargetAtTime(0.4, now, 0.3);
      this.droneFilter?.frequency.setTargetAtTime(900, now, 0.4);
      this.startChasePulse();
    } else {
      this.droneGain.gain.setTargetAtTime(0.18, now, 1.2);
      this.droneFilter?.frequency.setTargetAtTime(300, now, 1.2);
      this.stopChasePulse();
    }
  }

  private startChasePulse(): void {
    if (this.chasePulseInterval !== null || !this.ctx) return;
    this.chasePulseInterval = window.setInterval(() => this.playPulse(), 550);
  }

  private stopChasePulse(): void {
    if (this.chasePulseInterval !== null) {
      window.clearInterval(this.chasePulseInterval);
      this.chasePulseInterval = null;
    }
  }

  private playPulse(): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 95;
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(this.sfxGain);
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  private playStinger(): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, this.ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.65);
  }

  private playCaughtSting(): void {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.5;
    noise.connect(gain);
    gain.connect(this.sfxGain);
    noise.start();
  }

  private playDoorCreak(): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140 + Math.random() * 40, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(90, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  private playNoiseTick(sourceTag: string): void {
    if (!this.ctx || sourceTag !== "footstep") return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 60 + Math.random() * 20;
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.09);
  }
}
