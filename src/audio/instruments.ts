import * as Tone from "tone";

export type DriveMode = "clean" | "overdrive" | "distortion";

export interface DrumKit {
  kick: Tone.MembraneSynth;
  snare: Tone.NoiseSynth;
  snareBody: Tone.MembraneSynth;
  closedHat: Tone.NoiseSynth;
  openHat: Tone.NoiseSynth;
  dispose(): void;
}

export interface Rig {
  master: Tone.Limiter;
  guitar: Tone.PolySynth;
  guitarVolume: Tone.Volume;
  bass: Tone.MonoSynth;
  bassVolume: Tone.Volume;
  drums: DrumKit;
  drumVolume: Tone.Volume;
  setDrive(mode: DriveMode, amount: number): void;
  setTone(value: number): void;
  setVolumes(v: { guitar: number; bass: number; drums: number }): void;
  dispose(): void;
}

/**
 * Build the full audio rig: a distorted rhythm-guitar amp chain, a punchy
 * mono bass, a synthesised drum kit, and a glued master bus.
 */
export function createRig(): Rig {
  // ---- Master bus: gentle glue compression then a brick-wall limiter. ----
  const limiter = new Tone.Limiter(-1).toDestination();
  const masterComp = new Tone.Compressor({
    threshold: -18,
    ratio: 3,
    attack: 0.01,
    release: 0.2,
  }).connect(limiter);
  const masterReverb = new Tone.Reverb({ decay: 1.4, wet: 0.12 }).connect(masterComp);

  // ---- Guitar amp/cabinet chain ----
  // Sawtooth source -> tighten lows -> waveshaper drive -> presence -> cab roll-off.
  const guitar = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.005, decay: 0.18, sustain: 0.45, release: 0.35 },
  });
  guitar.maxPolyphony = 48;

  const guitarVolume = new Tone.Volume(-6);
  const tighten = new Tone.Filter(95, "highpass");
  const drive = new Tone.Distortion({ distortion: 0.45, oversample: "4x" });
  const presence = new Tone.Filter({ type: "peaking", frequency: 2200, Q: 1.1, gain: 4 });
  const cabinet = new Tone.Filter({ type: "lowpass", frequency: 5000, rolloff: -24 });

  guitar.chain(tighten, drive, presence, cabinet, guitarVolume, masterReverb);

  // ---- Bass: mono sawtooth with a filter envelope for punch, light grit. ----
  const bass = new Tone.MonoSynth({
    oscillator: { type: "sawtooth" },
    filter: { Q: 1, type: "lowpass", rolloff: -24 },
    envelope: { attack: 0.012, decay: 0.2, sustain: 0.85, release: 0.25 },
    filterEnvelope: {
      attack: 0.012,
      decay: 0.18,
      sustain: 0.4,
      release: 0.4,
      baseFrequency: 90,
      octaves: 2.6,
    },
  });
  const bassVolume = new Tone.Volume(-4);
  const bassGrit = new Tone.Distortion({ distortion: 0.08, oversample: "2x" });
  const bassTone = new Tone.Filter({ type: "lowpass", frequency: 2200, rolloff: -12 });
  bass.chain(bassGrit, bassTone, bassVolume, masterComp);

  // ---- Drum kit ----
  const drumVolume = new Tone.Volume(-3);
  const drumBus = drumVolume;
  drumBus.connect(masterReverb);

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.045,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.2 },
  });
  const kickShape = new Tone.Filter({ type: "lowpass", frequency: 3000 });
  kick.chain(kickShape, drumBus);

  // Snare: noise crack + a short tonal body.
  const snare = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.16, sustain: 0 },
  });
  const snareEq = new Tone.Filter({ type: "bandpass", frequency: 1900, Q: 0.7 });
  snare.chain(snareEq, drumBus);
  const snareBody = new Tone.MembraneSynth({
    pitchDecay: 0.03,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
  });
  const snareBodyVol = new Tone.Volume(-10);
  snareBody.chain(snareBodyVol, drumBus);

  const closedHat = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
  });
  const closedHatEq = new Tone.Filter({ type: "highpass", frequency: 8000 });
  const closedHatVol = new Tone.Volume(-12);
  closedHat.chain(closedHatEq, closedHatVol, drumBus);

  const openHat = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.3, sustain: 0 },
  });
  const openHatEq = new Tone.Filter({ type: "highpass", frequency: 8000 });
  const openHatVol = new Tone.Volume(-14);
  openHat.chain(openHatEq, openHatVol, drumBus);

  const drums: DrumKit = {
    kick,
    snare,
    snareBody,
    closedHat,
    openHat,
    dispose() {
      [kick, snare, snareBody, closedHat, openHat].forEach((d) => d.dispose());
      [kickShape, snareEq, snareBodyVol, closedHatEq, closedHatVol, openHatEq, openHatVol].forEach(
        (n) => n.dispose(),
      );
    },
  };

  function setDrive(mode: DriveMode, amount: number) {
    // amount: 0..1 user knob. Map per mode to a musical range.
    if (mode === "clean") {
      drive.distortion = 0.02 + amount * 0.06;
      cabinet.frequency.value = 6500;
      guitar.set({ oscillator: { type: "triangle" } });
    } else if (mode === "overdrive") {
      drive.distortion = 0.25 + amount * 0.35;
      cabinet.frequency.value = 5200;
      guitar.set({ oscillator: { type: "sawtooth" } });
    } else {
      drive.distortion = 0.6 + amount * 0.38;
      cabinet.frequency.value = 4600;
      guitar.set({ oscillator: { type: "sawtooth" } });
    }
  }

  function setTone(value: number) {
    // value 0..1 -> cabinet brightness 3000..7000 Hz and presence gain.
    cabinet.frequency.value = 3000 + value * 4000;
    presence.gain.value = 1 + value * 6;
  }

  function setVolumes(v: { guitar: number; bass: number; drums: number }) {
    guitarVolume.volume.value = v.guitar;
    bassVolume.volume.value = v.bass;
    drumVolume.volume.value = v.drums;
  }

  return {
    master: limiter,
    guitar,
    guitarVolume,
    bass,
    bassVolume,
    drums,
    drumVolume,
    setDrive,
    setTone,
    setVolumes,
    dispose() {
      guitar.dispose();
      [tighten, drive, presence, cabinet, guitarVolume].forEach((n) => n.dispose());
      bass.dispose();
      [bassGrit, bassTone, bassVolume].forEach((n) => n.dispose());
      drums.dispose();
      drumVolume.dispose();
      masterReverb.dispose();
      masterComp.dispose();
      limiter.dispose();
    },
  };
}
