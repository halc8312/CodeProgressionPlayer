import "./style.css";
import {
  BassPattern,
  DrumPattern,
  EngineConfig,
  GuitarRhythm,
  SongEngine,
} from "./audio/engine";
import { DriveMode } from "./audio/instruments";
import { parseChord, ParsedChord } from "./audio/theory";

const PRESETS: Array<{ name: string; value: string }> = [
  { name: "王道 (Am F C G)", value: "Am F C G" },
  { name: "カノン (C G Am Em F C F G)", value: "C G Am Em F C F G" },
  { name: "パワーコード (E5 G5 A5)", value: "E5 G5 A5" },
  { name: "ブルース (A7 D7 E7)", value: "A7 A7 D7 A7 E7 D7 A7 E7" },
  { name: "J-ROCK (F G Em Am)", value: "F G Em Am" },
  { name: "ジャズ (Cmaj7 A7 Dm7 G7)", value: "Cmaj7 A7 Dm7 G7" },
];

interface ParsedToken {
  raw: string;
  chord: ParsedChord | null;
}

function parseProgression(text: string): ParsedToken[] {
  return text
    .split(/[\s|]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((raw) => ({ raw, chord: parseChord(raw) }));
}

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const els = {
  progression: $<HTMLInputElement>("progression"),
  presets: $<HTMLDivElement>("presets"),
  chordStrip: $<HTMLDivElement>("chord-strip"),
  bpm: $<HTMLInputElement>("bpm"),
  bpmValue: $<HTMLSpanElement>("bpm-value"),
  bars: $<HTMLSelectElement>("bars"),
  driveMode: $<HTMLSelectElement>("drive-mode"),
  drive: $<HTMLInputElement>("drive"),
  tone: $<HTMLInputElement>("tone"),
  guitarRhythm: $<HTMLSelectElement>("guitar-rhythm"),
  guitarVol: $<HTMLInputElement>("guitar-vol"),
  bassPattern: $<HTMLSelectElement>("bass-pattern"),
  bassVol: $<HTMLInputElement>("bass-vol"),
  drumPattern: $<HTMLSelectElement>("drum-pattern"),
  drumVol: $<HTMLInputElement>("drum-vol"),
  play: $<HTMLButtonElement>("play"),
};

let engine: SongEngine | null = null;
let activeChordIndex = -1;

function buildConfig(): EngineConfig {
  const tokens = parseProgression(els.progression.value);
  const chords = tokens
    .map((t) => t.chord)
    .filter((c): c is ParsedChord => c !== null);
  return {
    chords,
    barsPerChord: Number(els.bars.value),
    bpm: Number(els.bpm.value),
    drumPattern: els.drumPattern.value as DrumPattern,
    guitarRhythm: els.guitarRhythm.value as GuitarRhythm,
    bassPattern: els.bassPattern.value as BassPattern,
    driveMode: els.driveMode.value as DriveMode,
    driveAmount: Number(els.drive.value),
    tone: Number(els.tone.value),
    volumes: {
      guitar: Number(els.guitarVol.value),
      bass: Number(els.bassVol.value),
      drums: Number(els.drumVol.value),
    },
  };
}

function renderChordStrip(): void {
  const tokens = parseProgression(els.progression.value);
  els.chordStrip.innerHTML = "";
  // Map token index -> valid-chord index so highlighting matches the engine.
  let validIndex = 0;
  tokens.forEach((t) => {
    const chip = document.createElement("div");
    chip.className = "chord-chip";
    chip.textContent = t.raw;
    if (!t.chord) {
      chip.classList.add("invalid");
      chip.title = "解釈できないコードです";
    } else {
      const myIndex = validIndex;
      chip.dataset.chordIndex = String(myIndex);
      if (myIndex === activeChordIndex) chip.classList.add("active");
      validIndex += 1;
    }
    els.chordStrip.appendChild(chip);
  });
}

function highlightChord(index: number): void {
  activeChordIndex = index;
  els.chordStrip.querySelectorAll(".chord-chip").forEach((chip) => {
    const el = chip as HTMLElement;
    el.classList.toggle("active", el.dataset.chordIndex === String(index));
  });
}

function pushConfig(): void {
  if (engine) engine.updateConfig(buildConfig());
}

function buildPresets(): void {
  PRESETS.forEach((preset) => {
    const btn = document.createElement("button");
    btn.className = "preset-btn";
    btn.type = "button";
    btn.textContent = preset.name;
    btn.addEventListener("click", () => {
      els.progression.value = preset.value;
      renderChordStrip();
      pushConfig();
    });
    els.presets.appendChild(btn);
  });
}

async function togglePlay(): Promise<void> {
  if (!engine) {
    engine = new SongEngine(buildConfig());
    engine.onBar((chordIndex) => highlightChord(chordIndex));
  }

  if (engine.isPlaying) {
    engine.stop();
    activeChordIndex = -1;
    renderChordStrip();
    setPlayButton(false);
  } else {
    const config = buildConfig();
    if (config.chords.length === 0) {
      els.progression.focus();
      return;
    }
    engine.updateConfig(config);
    await engine.start();
    setPlayButton(true);
  }
}

function setPlayButton(playing: boolean): void {
  els.play.classList.toggle("playing", playing);
  els.play.querySelector(".play-icon")!.textContent = playing ? "■" : "▶";
  els.play.querySelector(".play-text")!.textContent = playing ? "停止" : "再生";
}

function wireControls(): void {
  els.play.addEventListener("click", () => void togglePlay());

  els.progression.addEventListener("input", () => {
    renderChordStrip();
    pushConfig();
  });

  els.bpm.addEventListener("input", () => {
    els.bpmValue.textContent = els.bpm.value;
    pushConfig();
  });

  [
    els.bars,
    els.driveMode,
    els.drive,
    els.tone,
    els.guitarRhythm,
    els.guitarVol,
    els.bassPattern,
    els.bassVol,
    els.drumPattern,
    els.drumVol,
  ].forEach((el) => el.addEventListener("input", pushConfig));
}

buildPresets();
renderChordStrip();
wireControls();
