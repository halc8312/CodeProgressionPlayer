// Music theory helpers: chord-symbol parsing and voicing generation.

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

// Chord quality -> intervals (semitones from the root).
// Order matters: longer suffixes must be tested before shorter ones.
const QUALITIES: Array<{ suffix: string; intervals: number[] }> = [
  { suffix: "maj7", intervals: [0, 4, 7, 11] },
  { suffix: "maj9", intervals: [0, 4, 7, 11, 14] },
  { suffix: "m7b5", intervals: [0, 3, 6, 10] },
  { suffix: "m7", intervals: [0, 3, 7, 10] },
  { suffix: "m9", intervals: [0, 3, 7, 10, 14] },
  { suffix: "m6", intervals: [0, 3, 7, 9] },
  { suffix: "madd9", intervals: [0, 3, 7, 14] },
  { suffix: "dim7", intervals: [0, 3, 6, 9] },
  { suffix: "dim", intervals: [0, 3, 6] },
  { suffix: "aug", intervals: [0, 4, 8] },
  { suffix: "sus2", intervals: [0, 2, 7] },
  { suffix: "sus4", intervals: [0, 5, 7] },
  { suffix: "sus", intervals: [0, 5, 7] },
  { suffix: "add9", intervals: [0, 4, 7, 14] },
  { suffix: "6", intervals: [0, 4, 7, 9] },
  { suffix: "9", intervals: [0, 4, 7, 10, 14] },
  { suffix: "7", intervals: [0, 4, 7, 10] },
  { suffix: "5", intervals: [0, 7] }, // power chord
  { suffix: "m", intervals: [0, 3, 7] },
  { suffix: "min", intervals: [0, 3, 7] },
  { suffix: "maj", intervals: [0, 4, 7] },
  { suffix: "", intervals: [0, 4, 7] }, // plain major
];

export interface ParsedChord {
  symbol: string;
  rootPc: number; // root pitch class 0-11
  bassPc: number; // bass pitch class (for slash chords) 0-11
  intervals: number[];
  isPowerChord: boolean;
}

function parseNoteName(s: string): { pc: number; rest: string } | null {
  const m = /^([A-Ga-g])([#b]?)(.*)$/.exec(s);
  if (!m) return null;
  const letter = m[1].toUpperCase();
  let pc = NOTE_TO_SEMITONE[letter];
  if (pc === undefined) return null;
  if (m[2] === "#") pc = (pc + 1) % 12;
  else if (m[2] === "b") pc = (pc + 11) % 12;
  return { pc, rest: m[3] };
}

/**
 * Parse a chord symbol such as "Am", "Cmaj7", "G/B", "E5".
 * Returns null when the symbol cannot be understood.
 */
export function parseChord(raw: string): ParsedChord | null {
  const symbol = raw.trim();
  if (!symbol) return null;

  // Slash chord: split bass note off the end.
  let bassPc: number | null = null;
  let head = symbol;
  const slashIdx = symbol.indexOf("/");
  if (slashIdx >= 0) {
    head = symbol.slice(0, slashIdx);
    const bass = parseNoteName(symbol.slice(slashIdx + 1));
    if (bass) bassPc = bass.pc;
  }

  const parsedRoot = parseNoteName(head);
  if (!parsedRoot) return null;

  const quality =
    QUALITIES.find((q) => parsedRoot.rest === q.suffix) ??
    QUALITIES.find((q) => q.suffix !== "" && parsedRoot.rest.startsWith(q.suffix));

  const intervals = quality ? quality.intervals : [0, 4, 7];

  return {
    symbol,
    rootPc: parsedRoot.pc,
    bassPc: bassPc ?? parsedRoot.pc,
    intervals,
    isPowerChord: quality?.suffix === "5",
  };
}

/** MIDI note number -> Tone.js note name (e.g. 40 -> "E2"). */
export function midiToNoteName(midi: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midi / 12) - 1;
  return `${names[midi % 12]}${octave}`;
}

/** Place a pitch class into the lowest MIDI note within [minMidi, minMidi+11]. */
function pcInRange(pc: number, minMidi: number): number {
  const base = minMidi - (minMidi % 12) + pc;
  return base < minMidi ? base + 12 : base;
}

/**
 * Build a guitar voicing (array of MIDI notes) for a chord. The voicing is
 * spread across a guitar-ish range and lightly doubled for body.
 */
export function guitarVoicing(chord: ParsedChord): number[] {
  // Root somewhere around E2..D#3 so chords sit in a rhythm-guitar range.
  const rootMidi = pcInRange(chord.rootPc, 40);

  if (chord.isPowerChord) {
    // Root, fifth, octave, octave+fifth — classic distorted power chord.
    return [rootMidi, rootMidi + 7, rootMidi + 12, rootMidi + 19];
  }

  const notes = new Set<number>();
  for (const interval of chord.intervals) {
    notes.add(rootMidi + interval);
  }
  // Double the root and third an octave up for a fuller strummed voicing.
  notes.add(rootMidi + 12);
  notes.add(rootMidi + (chord.intervals[1] ?? 4) + 12);

  return Array.from(notes).sort((a, b) => a - b);
}

/** Bass root note (MIDI) for the chord, honouring slash-chord bass notes. */
export function bassNote(chord: ParsedChord): number {
  // Keep the bass in a low register around E1..D#2.
  return pcInRange(chord.bassPc, 28);
}
