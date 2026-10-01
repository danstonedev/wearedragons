import { useEffect, useRef, useState } from "react";
import { gameSession } from "../game/runtime";
import { raidEmitter, raidHud } from "./raidState";
import type { RaidCue } from "./raidState";

interface Rig { context: AudioContext; master: GainNode; noise: AudioBuffer }

/** Synthesized lair sound: snores, footsteps, coins, growls, and a heartbeat when danger rises. */
export default function RaidAudio() {
  const rig = useRef<Rig | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const enabledRef = useRef(false);

  useEffect(() => {
    const ready = () => {
      const audio = rig.current;
      return audio && enabledRef.current && audio.context.state === "running" ? audio : null;
    };
    const tone = (type: OscillatorType, from: number, to: number, volume: number, duration: number, delay = 0, filter?: number) => {
      const audio = ready();
      if (!audio) return;
      const start = audio.context.currentTime + delay;
      const oscillator = audio.context.createOscillator();
      const gain = audio.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(volume, start + Math.min(0.04, duration * 0.2));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      let node: AudioNode = oscillator;
      if (filter) {
        const lowpass = audio.context.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.frequency.value = filter;
        node = oscillator.connect(lowpass);
      }
      node.connect(gain).connect(audio.master);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.05);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    };
    const noise = (volume: number, duration: number, frequency: number, type: BiquadFilterType = "lowpass", delay = 0) => {
      const audio = ready();
      if (!audio) return;
      const start = audio.context.currentTime + delay;
      const source = audio.context.createBufferSource();
      source.buffer = audio.noise;
      const filter = audio.context.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = frequency;
      const gain = audio.context.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(volume, start + duration * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(filter).connect(gain).connect(audio.master);
      source.start(start, Math.random() * 1.5, duration + 0.05);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
    };
    const play = (event: Event) => {
      const { cue, gait, prize } = (event as CustomEvent<{ cue: RaidCue; gait?: string; prize?: boolean }>).detail;
      switch (cue) {
        case "step": noise(gait === "sprint" ? 0.12 : gait === "walk" ? 0.06 : 0.025, 0.09, gait === "sneak" ? 900 : 1600, "bandpass"); break;
        case "grab": [1319, 1568, 1976].forEach((note, i) => tone("triangle", note, note, 0.07, 0.3, i * 0.05)); if (prize) [784, 988, 1175, 1568].forEach((note, i) => tone("sine", note, note, 0.08, 0.6, 0.2 + i * 0.08)); break;
        case "drop": tone("sine", 220, 90, 0.12, 0.2); break;
        case "throw": noise(0.05, 0.18, 2400, "highpass"); break;
        case "plink": tone("square", 1800, 1200, 0.05, 0.06); tone("square", 1500, 900, 0.04, 0.05, 0.09); break;
        case "snore": noise(0.16, 1.4, 180); tone("sawtooth", 55, 42, 0.05, 1.3, 0, 240); break;
        case "stir": tone("sawtooth", 95, 70, 0.1, 0.7, 0, 400); break;
        case "wake": tone("sawtooth", 120, 60, 0.16, 1.1, 0, 500); noise(0.08, 0.9, 300); break;
        case "spot": tone("square", 440, 880, 0.08, 0.25); tone("square", 660, 1320, 0.08, 0.3, 0.18); tone("sawtooth", 140, 60, 0.15, 1, 0.1, 600); break;
        case "lost": tone("triangle", 520, 260, 0.06, 0.6); break;
        case "settle": noise(0.07, 1.2, 260); break;
        case "caught": tone("sawtooth", 180, 45, 0.22, 1.4, 0, 900); noise(0.18, 1.2, 600); break;
        case "escape": [523, 659, 784, 1047].forEach((note, i) => tone("triangle", note, note, 0.09, 0.45, i * 0.09)); break;
        case "denied": tone("square", 160, 140, 0.06, 0.18); break;
      }
    };
    raidEmitter.addEventListener("cue", play);
    // Heartbeat: faster and louder as the dragons grow suspicious.
    let beat = 0;
    const timer = window.setInterval(() => {
      if (gameSession.paused) return;
      const danger = Math.max(0, ...raidHud.dragons.map(dragon => dragon.mode === "chase" ? 100 : dragon.suspicion));
      if (danger < 45) { beat = 0; return; }
      beat += 0.1;
      const period = danger >= 100 ? 0.45 : 1.1 - danger / 200;
      if (beat >= period) {
        beat = 0;
        tone("sine", 62, 48, 0.12 + danger / 900, 0.14);
        tone("sine", 58, 44, 0.09 + danger / 1200, 0.14, 0.16);
      }
    }, 100);
    return () => {
      raidEmitter.removeEventListener("cue", play);
      window.clearInterval(timer);
      const audio = rig.current;
      rig.current = null;
      if (audio) void audio.context.close().catch(() => {});
    };
  }, []);

  const toggle = async () => {
    try {
      if (!rig.current) {
        const context = new AudioContext();
        const master = context.createGain();
        master.gain.value = 0.6;
        master.connect(context.destination);
        const noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        rig.current = { context, master, noise };
      }
      await rig.current.context.resume();
      enabledRef.current = !enabled;
      setEnabled(!enabled);
    } catch { setUnavailable(true); }
  };
  return <button type="button" className="flight-sound raid-sound" aria-pressed={enabled} disabled={unavailable} onClick={() => { void toggle(); }}>
    {unavailable ? "SOUND UNAVAILABLE" : enabled ? "SOUND ON" : "ENABLE SOUND"}
  </button>;
}
