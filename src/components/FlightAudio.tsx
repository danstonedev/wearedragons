import { useEffect, useRef, useState } from "react";
import { fireballEmitter, gameSession, missionEmitter, playerStatus } from "../game/runtime";

interface SoundRig { context: AudioContext; wind: GainNode; wing: GainNode; master: GainNode }

/** Lightweight synthesized sound; user gesture starts audio, no media downloads. */
export default function FlightAudio() {
  const rig = useRef<SoundRig | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const lastBeat = useRef(-1);
  const lastShot = useRef(-1);
  useEffect(() => {
    const pulse = (frequency: number, volume: number, duration: number) => {
      const audio = rig.current;
      if (!audio || gameSession.paused || audio.context.state !== "running" || audio.master.gain.value === 0) return;
      const now = audio.context.currentTime;
      const oscillator = audio.context.createOscillator();
      const gain = audio.context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.4, now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      oscillator.connect(gain).connect(audio.master);
      oscillator.start(now); oscillator.stop(now + duration);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    };
    // A clean bell tone for treasure; delay lets several notes form a short phrase.
    const chime = (frequency: number, volume: number, duration: number, delay = 0) => {
      const audio = rig.current;
      if (!audio || gameSession.paused || audio.context.state !== "running" || audio.master.gain.value === 0) return;
      const start = audio.context.currentTime + delay;
      const oscillator = audio.context.createOscillator();
      const gain = audio.context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain).connect(audio.master);
      oscillator.start(start); oscillator.stop(start + duration + 0.02);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    };
    const shot = () => {
      if (gameSession.elapsed - lastShot.current < 0.1) return;
      lastShot.current = gameSession.elapsed;
      pulse(180, 0.12, 0.15);
    };
    const impact = (event: Event) => { if (!(event as CustomEvent<{ quiet?: boolean }>).detail?.quiet) pulse(75, 0.2, 0.24); };
    const snatched = () => { chime(880, 0.11, 0.35); chime(1318, 0.09, 0.45, 0.08); };
    const banked = () => { [988, 1175, 1319, 1568, 1976].forEach((note, i) => chime(note, 0.08, 0.4, i * 0.06)); };
    const dropped = () => pulse(320, 0.07, 0.22);
    fireballEmitter.addEventListener("shoot", shot);
    missionEmitter.addEventListener("impact", impact);
    missionEmitter.addEventListener("loot_snatched", snatched);
    missionEmitter.addEventListener("loot_banked", banked);
    missionEmitter.addEventListener("loot_dropped", dropped);
    const timer = window.setInterval(() => {
      const audio = rig.current;
      if (!audio || audio.context.state !== "running") return;
      const now = audio.context.currentTime;
      const running = !gameSession.paused && gameSession.ready;
      const speed = Math.min(1, playerStatus.speed / 28);
      audio.wind.gain.setTargetAtTime(running ? speed * speed * 0.16 : 0, now, 0.2);
      const flapping = running && !["grounded", "glide", "braking"].includes(playerStatus.flightMode);
      if (flapping && gameSession.elapsed - lastBeat.current > 0.85 - speed * 0.3) {
        lastBeat.current = gameSession.elapsed;
        audio.wing.gain.cancelScheduledValues(now);
        audio.wing.gain.setValueAtTime(0.001, now);
        audio.wing.gain.linearRampToValueAtTime(0.12, now + 0.07);
        audio.wing.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      } else if (!flapping) {
        audio.wing.gain.cancelScheduledValues(now);
        audio.wing.gain.setTargetAtTime(0, now, 0.03);
      }
    }, 100);
    return () => {
      window.clearInterval(timer);
      fireballEmitter.removeEventListener("shoot", shot);
      missionEmitter.removeEventListener("impact", impact);
      missionEmitter.removeEventListener("loot_snatched", snatched);
      missionEmitter.removeEventListener("loot_banked", banked);
      missionEmitter.removeEventListener("loot_dropped", dropped);
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
        master.gain.value = 0;
        master.connect(context.destination);
        const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const source = context.createBufferSource();
        source.buffer = buffer; source.loop = true;
        const windFilter = context.createBiquadFilter(); windFilter.type = "lowpass"; windFilter.frequency.value = 1200;
        const wingFilter = context.createBiquadFilter(); wingFilter.type = "lowpass"; wingFilter.frequency.value = 220;
        const wind = context.createGain(), wing = context.createGain();
        wind.gain.value = 0; wing.gain.value = 0;
        source.connect(windFilter).connect(wind).connect(master);
        source.connect(wingFilter).connect(wing).connect(master);
        source.start();
        rig.current = { context, wind, wing, master };
      }
      await rig.current.context.resume();
      rig.current.master.gain.value = enabled ? 0 : 0.5;
      setEnabled(!enabled);
    } catch { setUnavailable(true); }
  };
  return <button type="button" className="flight-sound" aria-pressed={enabled} disabled={unavailable} onClick={() => { void toggle(); }}>{unavailable ? "SOUND UNAVAILABLE" : enabled ? "SOUND ON" : "ENABLE SOUND"}</button>;
}
