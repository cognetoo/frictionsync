/**
 * Signals coming from the content script.
 * We keep this minimal because messages cross extension boundaries.
 */
export type Signal =
  | { type: "hover"; term: string; ms: number; t: number }
  | { type: "backscroll"; count: number; t: number }
  | { type: "dwell"; paragraph: number; ms: number; t: number }
  | { type: "click"; x: number; y: number; t: number };

/**
 * Context summary used by Agent A (Observer).
 */
export type SignalContext = {
  total: number;
  hoverTerms: string[];
  backscrolls: number;
  maxDwellMs: number;
  lastSignalTime: number | null;
  hoverRepeats: number
};

const MAX_SIGNALS_PER_TAB = 40;

/**
 * Internal in-memory buffer.
 * maintaining a map so that signals aren't mixed and each tab has an id mapped to signals
 */
const buffer = new Map<number, Signal[]>();

/**
 * new signal for a tab.
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
  let currentStreak = 0; //Counts how many times the same term appeared consecutively.
  let maxHoverRepeats = 0; //Tracks the largest streak found so far

  for (const s of signals) {
    if (s.type === "backscroll") {
      backscrolls += s.count;
    }

    if (s.type === "dwell") {
      maxDwell = Math.max(maxDwell, s.ms);
    }

    if (s.type === "hover") {
      hoverTerms.push(s.term);
    
      if (s.term.trim().toLowerCase() === lastHoverTerm) {
    currentStreak++;
  } else {
    currentStreak = 1;
  }

  maxHoverRepeats = Math.max(maxHoverRepeats, currentStreak);
  lastHoverTerm = s.term;
}
  }

  return {
    total: signals.length, //no. of signals received per tab
    hoverTerms,
    backscrolls,
    maxDwellMs: maxDwell,
    hoverRepeats: maxHoverRepeats,
    lastSignalTime: signals.length ? signals[signals.length - 1].t : null
  };
}

/**
 * Clear signals when a tab reloads.
 */
export function clearTab(tabId: number) {
  buffer.delete(tabId);
}