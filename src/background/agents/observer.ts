import type { SignalContext } from "../store/signalBuffer";

export type ObserverDecision = {
  frictionScore: number; // 0..1
  label: "Curiosity" | "Friction";
  shouldIntervene: boolean;
  concept: string | null; // what term/topic to explain
  reasons: string[]; // for debugging 
};

export type ObserverConfig = {
  threshold: number;         // if frictionScore >= threshold -> intervene
  dwellMsHigh: number;       // long dwell threshold
  backscrollHigh: number;    // backscroll threshold
  hoverRepeatsHigh: number;  // repeated hover threshold
};

export const DEFAULT_OBSERVER_CONFIG: ObserverConfig = {
  threshold: 0.65,
  dwellMsHigh: 30000,
  backscrollHigh: 2,
  hoverRepeatsHigh: 3
};

/**
 * Agent A: Observer
 * Converts short-term signal context into a decision.
 */
export function observe(
  ctx: SignalContext,
  config: ObserverConfig = DEFAULT_OBSERVER_CONFIG
): ObserverDecision {
  const reasons: string[] = [];

  // ---- Feature extraction
  const hasLongDwell = ctx.maxDwellMs >= config.dwellMsHigh;
  const hasBackscroll = ctx.backscrolls >= config.backscrollHigh;
  const hasHoverRepeat = ctx.hoverRepeats >= config.hoverRepeatsHigh;

  if (hasLongDwell) reasons.push(`Long dwell (${ctx.maxDwellMs}ms)`);
  if (hasBackscroll) reasons.push(`Backscrolls (${ctx.backscrolls})`);
  if (hasHoverRepeat) reasons.push(`Hover repeats (${ctx.hoverRepeats})`);

  // ---- Score calculation 
  let score = 0.15;

  if (hasLongDwell) score += 0.35;
  if (hasBackscroll) score += 0.30;
  if (hasHoverRepeat) score += 0.35;

  // Cap to 1.0
  score = Math.min(1, score);

  // ---- Concept selection
  // We choose the "best" concept candidate from hoverTerms.
  // Heuristic: most recent hover term is usually the stuck concept.
  const concept = pickConcept(ctx.hoverTerms);

  // ---- Decision
  const shouldIntervene = score >= config.threshold && !!concept;

  const label: "Curiosity" | "Friction" = score >= config.threshold ? "Friction" : "Curiosity";

  return {
    frictionScore: score,
    label,
    shouldIntervene,
    concept,
    reasons
  };
}

export function pickConcept(hoverTerms: string[]): string | null {

  for (let i = hoverTerms.length - 1; i >= 0; i--){
    const term = hoverTerms[i].trim().toLowerCase()
     if (term.length > 0) {
      return term;
    }

  }
  
  return null;
}