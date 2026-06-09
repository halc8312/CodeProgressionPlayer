import * as Tone from "tone";
import { createRig, DriveMode, Rig } from "./instruments";
import {
  bassNote,
  guitarVoicing,
  midiToNoteName,
  ParsedChord,
} from "./theory";

export type DrumPattern = "rock8" | "rock16" | "halftime" | "fourfloor" | "off";
export type GuitarRhythm = "sustain" | "quarter" | "eighth" | "off";
export type BassPattern = "whole" | "quarter" | "eighth" | "off";

export interface EngineConfig {
  chords: ParsedChord[];
  barsPerChord: number;
  bpm: number;
  drumPattern: DrumPattern;
  guitarRhythm: GuitarRhythm;
  bassPattern: BassPattern;
  driveMode: DriveMode;
  driveAmount: number;
  tone: number;
  volumes: { guitar: number; bass: number; drums: number };
}

// 16th-step indices (0..15) per bar for each drum voice.
interface DrumSteps {
  kick: number[];
  snare: number[];
  closedHat: number[];
  openHat: number[];
}

const DRUM_PATTERNS: Record<Exclude<DrumPattern, "off">, DrumSteps> = {
  rock8: {
    kick: [0, 8, 10],
    snare: [4, 12],
    closedHat: [0, 2, 4, 6, 8, 10, 12, 14],
    openHat: [],
  },
  rock16: {
    kick: [0, 8, 11],
    snare: [4, 12],
    closedHat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    openHat: [],
  },
  halftime: {
    kick: [0, 6],
    snare: [8],
    closedHat: [0, 2, 4, 6, 8, 10, 12, 14],
    openHat: [14],
  },
  fourfloor: {
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    closedHat: [2, 6, 10, 14],
    openHat: [],
  },
};

const GUITAR_STEPS: Record<Exclude<GuitarRhythm, "off" | "sustain">, number[]> = {
  quarter: [0, 4, 8, 12],
  eighth: [0, 2, 4, 6, 8, 10, 12, 14],
};

const BASS_STEPS: Record<Exclude<BassPattern, "off" | "whole">, number[]> = {
  quarter: [0, 4, 8, 12],
  eighth: [0, 2, 4, 6, 8, 10, 12, 14],
};

function stepToTime(absBar: number, step: number): string {
  return `${absBar}:${Math.floor(step / 4)}:${step % 4}`;
}

function humanize(base: number, spread = 0.08): number {
  return Math.max(0.05, Math.min(1, base + (Math.random() - 0.5) * spread));
}

export class SongEngine {
  private rig: Rig;
  private config: EngineConfig;
  private scheduledIds: number[] = [];
  private _isPlaying = false;
  private barCallback: ((chordIndex: number) => void) | null = null;

  constructor(config: EngineConfig) {
    this.config = config;
    this.rig = createRig();
    this.applyParams();
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  onBar(cb: (chordIndex: number) => void): void {
    this.barCallback = cb;
  }

  /** Apply non-structural params (drive/tone/volume/bpm) without rescheduling. */
  applyParams(): void {
    Tone.Transport.bpm.value = this.config.bpm;
    this.rig.setDrive(this.config.driveMode, this.config.driveAmount);
    this.rig.setTone(this.config.tone);
    this.rig.setVolumes(this.config.volumes);
  }

  updateConfig(partial: Partial<EngineConfig>): void {
    this.config = { ...this.config, ...partial };
    this.applyParams();
    if (this._isPlaying) {
      // Structural changes need a reschedule.
      this.reschedule();
    }
  }

  async start(): Promise<void> {
    if (this._isPlaying) return;
    await Tone.start();
    this.reschedule();
    Tone.Transport.start("+0.1");
    this._isPlaying = true;
  }

  stop(): void {
    Tone.Transport.stop();
    this.clearSchedule();
    this._isPlaying = false;
  }

  dispose(): void {
    this.stop();
    this.rig.dispose();
  }

  private clearSchedule(): void {
    this.scheduledIds.forEach((id) => Tone.Transport.clear(id));
    this.scheduledIds = [];
  }

  private reschedule(): void {
    this.clearSchedule();
    const { chords, barsPerChord } = this.config;
    if (chords.length === 0) return;

    const totalBars = chords.length * barsPerChord;
    Tone.Transport.loop = true;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = `${totalBars}m`;

    chords.forEach((chord, chordIndex) => {
      for (let b = 0; b < barsPerChord; b++) {
        const absBar = chordIndex * barsPerChord + b;
        const isChordStart = b === 0;
        this.scheduleGuitar(chord, absBar);
        this.scheduleBass(chord, absBar);
        this.scheduleDrums(absBar);
        if (isChordStart) this.scheduleBarCallback(chordIndex, absBar);
      }
    });
  }

  private scheduleBarCallback(chordIndex: number, absBar: number): void {
    const id = Tone.Transport.schedule((time) => {
      Tone.Draw.schedule(() => this.barCallback?.(chordIndex), time);
    }, stepToTime(absBar, 0));
    this.scheduledIds.push(id);
  }

  private scheduleGuitar(chord: ParsedChord, absBar: number): void {
    const rhythm = this.config.guitarRhythm;
    if (rhythm === "off") return;
    const notes = guitarVoicing(chord).map(midiToNoteName);

    const strum = (time: number, duration: string, vel: number) => {
      notes.forEach((note, i) => {
        this.rig.guitar.triggerAttackRelease(
          note,
          duration,
          time + i * 0.012,
          humanize(vel),
        );
      });
    };

    if (rhythm === "sustain") {
      const id = Tone.Transport.schedule(
        (time) => strum(time, "1m", 0.7),
        stepToTime(absBar, 0),
      );
      this.scheduledIds.push(id);
      return;
    }

    const duration = rhythm === "quarter" ? "4n" : "8n";
    for (const step of GUITAR_STEPS[rhythm]) {
      const accent = step % 4 === 0 ? 0.8 : 0.6;
      const id = Tone.Transport.schedule(
        (time) => strum(time, duration, accent),
        stepToTime(absBar, step),
      );
      this.scheduledIds.push(id);
    }
  }

  private scheduleBass(chord: ParsedChord, absBar: number): void {
    const pattern = this.config.bassPattern;
    if (pattern === "off") return;
    const note = midiToNoteName(bassNote(chord));

    if (pattern === "whole") {
      const id = Tone.Transport.schedule(
        (time) => this.rig.bass.triggerAttackRelease(note, "1m", time, 0.85),
        stepToTime(absBar, 0),
      );
      this.scheduledIds.push(id);
      return;
    }

    const duration = pattern === "quarter" ? "4n" : "8n";
    for (const step of BASS_STEPS[pattern]) {
      const accent = step % 4 === 0 ? 0.9 : 0.7;
      const id = Tone.Transport.schedule(
        (time) =>
          this.rig.bass.triggerAttackRelease(note, duration, time, humanize(accent)),
        stepToTime(absBar, step),
      );
      this.scheduledIds.push(id);
    }
  }

  private scheduleDrums(absBar: number): void {
    const pattern = this.config.drumPattern;
    if (pattern === "off") return;
    const steps = DRUM_PATTERNS[pattern];

    const schedule = (step: number, fn: (time: number) => void) => {
      const id = Tone.Transport.schedule(fn, stepToTime(absBar, step));
      this.scheduledIds.push(id);
    };

    for (const step of steps.kick) {
      schedule(step, (time) => this.rig.drums.kick.triggerAttackRelease("C1", "8n", time, humanize(0.9)));
    }
    for (const step of steps.snare) {
      schedule(step, (time) => {
        this.rig.drums.snare.triggerAttackRelease("16n", time, humanize(0.9));
        this.rig.drums.snareBody.triggerAttackRelease("D2", "16n", time, 0.6);
      });
    }
    for (const step of steps.closedHat) {
      schedule(step, (time) =>
        this.rig.drums.closedHat.triggerAttackRelease("16n", time, humanize(0.5, 0.12)),
      );
    }
    for (const step of steps.openHat) {
      schedule(step, (time) =>
        this.rig.drums.openHat.triggerAttackRelease("16n", time, humanize(0.5)),
      );
    }
  }
}
