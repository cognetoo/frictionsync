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
  if (hoverTerms.length === 0) return null;

  type CandidateData = {
    count: number;
    lastIndex: number;
  };

  const stats = new Map<string, CandidateData>();

  for (let i = 0; i < hoverTerms.length; i++) {
    const raw = hoverTerms[i];
    const term = normalizeConceptCandidate(raw);
    if (!term) continue;

    const cur = stats.get(term);
    if (cur) {
      cur.count += 1;
      cur.lastIndex = i;
    } else {
      stats.set(term, { count: 1, lastIndex: i });
    }
  }

  if (stats.size === 0) return null;

  let bestTerm: string | null = null;
  let bestScore = -Infinity;

  const total = hoverTerms.length;

  for (const [term, data] of stats.entries()) {
    const score = scoreConceptCandidate(term, data.count, data.lastIndex, total);

    if (score > bestScore) {
      bestScore = score;
      bestTerm = term;
    }
  }

  return bestTerm;
}

function normalizeConceptCandidate(term: string): string | null {
  const clean = term.trim().toLowerCase();

  if (!clean) return null;

  // reject pure numbers
  if (/^\d+$/.test(clean)) return null;

  // reject decade/year-like forms: 1980s, 2024, 1999
  if (/^\d{3,4}s?$/.test(clean)) return null;

  return clean;
}

function scoreConceptCandidate(
  term: string,
  count: number,
  lastIndex: number,
  totalTerms: number
): number {
  let score = 0;

  // reject empty
  if (!term) return -999;

  // reject pure numbers
  if (/^\d+$/.test(term)) return -999;

  // reject decade/year-like forms: 1980s, 2024, 1999
  if (/^\d{3,4}s?$/.test(term)) return -999;

  // weak/common terms
  const weakTerms = new Set([
    "same",
    "state",
    "many",
    "used",
    "using",
    "system",
    "information",
    "simple",
    "open",
    "link",
    "like",
    "from",
    "into",
    "concept",
    "concepts",
    "section",
    "page",
    "chapter",
    "type",
    "such",
    "very",
    "more"
  ]);

  if (weakTerms.has(term)) score -= 4;

  // repeated terms matter
  score += count * 2;

  // recency bonus: newer terms should matter more
  // term at the end of the hover list gets the biggest boost
  const recency = lastIndex / Math.max(1, totalTerms - 1);
  score += recency * 4;

  // length heuristic
  if (term.length >= 3 && term.length <= 8) score += 2;
  if (term.length > 8 && term.length <= 16) score += 1;

  // acronym / protocol-like terms
  const acronymish = new Set([
    "ospf", "tcp", "udp", "bgp", "rfc", "ip", "ipv4", "ipv6", "icmp", "dns"
  ]);
  if (acronymish.has(term)) score += 4;

  // technical-looking suffixes
  if (
    term.endsWith("tion") ||
    term.endsWith("sion") ||
    term.endsWith("ity") ||
    term.endsWith("ology") ||
    term.endsWith("orithm") ||
    term.endsWith("tocol")
  ) {
    score += 2;
  }

  // must contain letters
  if (!/[a-z]/i.test(term)) score -= 5;

  return score;
}