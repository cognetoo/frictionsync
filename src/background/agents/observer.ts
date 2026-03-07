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
  deadClicksHigh: number;    // dead click threshold
  rageClicksHigh: number;    // rage click threshold
};

export const DEFAULT_OBSERVER_CONFIG: ObserverConfig = {
  threshold: 0.66,
  dwellMsHigh: 30000,
  backscrollHigh: 2,
  hoverRepeatsHigh: 3,
  deadClicksHigh: 2,
  rageClicksHigh: 1
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
  const hasDeadClicks = ctx.deadClicks >= config.deadClicksHigh;
  const hasRageClicks = ctx.rageClicks >= config.rageClicksHigh;

  if (hasLongDwell) reasons.push(`Long dwell (${ctx.maxDwellMs}ms)`);
  if (hasBackscroll) reasons.push(`Backscrolls (${ctx.backscrolls})`);
  if (hasHoverRepeat) reasons.push(`Hover repeats (${ctx.hoverRepeats})`);
  if (hasDeadClicks) reasons.push(`Dead clicks (${ctx.deadClicks})`);
  if (hasRageClicks) reasons.push(`Rage clicks (${ctx.rageClicks})`);

  // ---- Score calculation
  // Rebalanced so adding click signals doesn't make intervention too easy.
  let score = 0.10;

  if (hasLongDwell) score += 0.24;
  if (hasBackscroll) score += 0.20;
  if (hasHoverRepeat) score += 0.22;
  if (hasDeadClicks) score += 0.12;
  if (hasRageClicks) score += 0.22;

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

  // reject mostly punctuation/symbols
  if (!/[a-z]/i.test(clean)) return null;

  return clean;
}

function scoreConceptCandidate(
  term: string,
  count: number,
  lastIndex: number,
  totalTerms: number
): number {
  let score = 0;

  if (!term) return -999;

  // hard rejects
  if (/^\d+$/.test(term)) return -999;
  if (/^\d{3,4}s?$/.test(term)) return -999;
  if (!/[a-z]/i.test(term)) return -999;

  // -------------------------
  // Soft penalties for generic words
  // -------------------------
  const weakPenaltyMap: Record<string, number> = {
    same: 4,
    very: 3,
    more: 3,
    such: 3,
    simple: 3,
    concept: 4,
    concepts: 4,
    chapter: 4,
    section: 4,
    page: 4,
    type: 3,
    example: 3,
    examples: 3,
    information: 2,
    first: 2,
    second: 2,
    many: 2,
    open: 2,
    link: 2,
    gathers : 2,
    originally: 2,
  };

  score -= weakPenaltyMap[term] ?? 0;

  // -------------------------
  // Core positive signals
  // -------------------------

  // repetition matters
  score += count * 2;

  // recency matters a lot
  const recency = lastIndex / Math.max(1, totalTerms - 1);
  score += recency * 4;

  // length heuristic: moderate length words are often better concepts
  if (term.length >= 3 && term.length <= 8) score += 2;
  else if (term.length <= 14) score += 1;

  // acronym / protocol-like words
  const acronymish = new Set([
    "ospf", "tcp", "udp", "bgp", "rfc", "ip", "ipv4", "ipv6", "icmp", "dns",
    "cidr", "asn", "mpls", "http", "https", "arp"
  ]);
  if (acronymish.has(term)) score += 4;

  // mixed letters + digits can be technical: ipv4, sha256, etc.
  if (/[a-z]/i.test(term) && /\d/.test(term)) {
    score += 2;
  }

  // technical-looking suffixes
  if (
    term.endsWith("tion") ||
    term.endsWith("sion") ||
    term.endsWith("ity") ||
    term.endsWith("ology") ||
    term.endsWith("orithm") ||
    term.endsWith("tocol") ||
    term.endsWith("graphy") ||
    term.endsWith("metry")
  ) {
    score += 2;
  }

  // networking / systems vocabulary gets a light boost
  const technicalBoostTerms = new Set([
    "routing",
    "router",
    "routers",
    "topology",
    "packet",
    "packets",
    "protocol",
    "protocols",
    "autonomous",
    "addressing",
    "subnet",
    "prefix",
    "broadcast",
    "unicast",
    "multicast",
    "interface",
    "interfaces",
    "convergence",
    "metric",
    "metrics",
    "forwarding"
  ]);
  if (technicalBoostTerms.has(term)) score += 2;

  // tiny penalty for very long generic-looking words
  if (term.length > 18) score -= 1;

  return score;
}