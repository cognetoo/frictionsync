/**
 * Signals coming from the content script.
 * Keep this minimal because messages cross extension boundaries.
 */
export type Signal =
  | { type: "hover"; term: string; ms: number; t: number; x: number; y: number }
  | { type: "backscroll"; count: number; t: number }
  | { type: "dwell"; paragraph: number; ms: number; t: number }
  | { type: "deadclick"; x: number; y: number; tag: string; t: number }
  | { type: "rageclick"; x: number; y: number; count: number; t: number };

/**
 * Context summary used by Agent A (Observer).
 */
export type SignalContext = {
  total: number;
  hoverTerms: string[];
  backscrolls: number;
  maxDwellMs: number;
  hoverRepeats: number;
  deadClicks: number;
  rageClicks: number;
  lastSignalTime: number | null;
};

const MAX_SIGNALS_PER_TAB = 40;

/**
 * Internal in-memory buffer.
 * Each tab gets its own signal list so signals don't mix across tabs.
 */
const buffer = new Map<number, Signal[]>();

/**
 * Add a new signal for a tab.
 */
export function addSignal(tabId: number, signal: Signal) {
  const arr = buffer.get(tabId) ?? [];

  arr.push(signal);

  // keep buffer size limited
  if (arr.length > MAX_SIGNALS_PER_TAB) {
    arr.shift();
  }

  buffer.set(tabId, arr);
}

/**
 * Get raw signals for debugging.
 */
export function getSignals(tabId: number): Signal[] {
  return buffer.get(tabId) ?? [];
}

/**
 * Build summarized context for Agent A.
 */
export function getContext(tabId: number): SignalContext {
  const signals = buffer.get(tabId) ?? [];

  let backscrolls = 0;
  let maxDwell = 0;
  const hoverTerms: string[] = [];

  let lastHoverTerm: string | null = null;
  let currentStreak = 0;      // how many times same hover term appeared consecutively
  let maxHoverRepeats = 0;    // maximum streak seen

  let deadClicks = 0;
  let rageClicks = 0;

  for (const s of signals) {
    if (s.type === "backscroll") {
      backscrolls += s.count;
    }

    if (s.type === "dwell") {
      maxDwell = Math.max(maxDwell, s.ms);
    }

    if (s.type === "hover") {
      const normalized = s.term.trim().toLowerCase();
      hoverTerms.push(normalized);

      if (normalized === lastHoverTerm) {
        currentStreak++;
      } else {
        currentStreak = 1;
      }

      maxHoverRepeats = Math.max(maxHoverRepeats, currentStreak);
      lastHoverTerm = normalized;
    }

    if (s.type === "deadclick") {
      deadClicks += 1;
    }

    if (s.type === "rageclick") {
      rageClicks += 1;
    }
  }

  const lastSignalTime =
    signals.length > 0 ? signals[signals.length - 1].t : null;

  return {
    total: signals.length,
    hoverTerms,
    backscrolls,
    maxDwellMs: maxDwell,
    hoverRepeats: maxHoverRepeats,
    deadClicks,
    rageClicks,
    lastSignalTime
  };
}

/**
 * Clear signals when a tab reloads or after intervention.
 */
export function clearTab(tabId: number) {
  buffer.delete(tabId);
}