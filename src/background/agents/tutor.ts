import type { UserProfile } from "../store/profileStore";

export type TutorRequest = {
  concept: string;
  pageTitle?: string;
};

export type TutorResponse = {
  title: string;
  body: string;
  cta: string;
  concept: string;
  styleTag: string;
  masteryBand: "beginner" | "intermediate" | "advanced";
};

/**
 * Agent B: Adaptive Tutor
 * Generates explanation depth based on mastery and user interests.
 */
export function tutor(req: TutorRequest, profile: UserProfile): TutorResponse {
  const concept = normalizeConcept(req.concept);
  const mastery = profile.mastery[concept] ?? 0;
  const masteryBand = getMasteryBand(mastery);

  const style = pickStyle(profile.interests, masteryBand);

  const title =
    masteryBand === "advanced"
      ? `Quick check: ${concept}`
      : `Quick help: ${concept}`;

  const body = buildAdaptiveExplanation(concept, style, mastery, masteryBand);

  return {
    title,
    body,
    cta: "Got it!",
    concept,
    styleTag: style,
    masteryBand
  };
}

/**
 * Normalize concept text to a stable key.
 */
export function normalizeConcept(c: string): string {
  return c.trim().toLowerCase().slice(0, 80);
}

/**
 * Convert mastery score into learning stage.
 */
export function getMasteryBand(
  mastery: number
): "beginner" | "intermediate" | "advanced" {
  if (mastery <= 2) return "beginner";
  if (mastery <= 5) return "intermediate";
  return "advanced";
}

/**
 * Pick a personalization style.
 * Beginner: interests strongly influence explanation style.
 * Intermediate: still personalize, but less heavily.
 * Advanced: usually prefer generic technical explanation.
 */
export function pickStyle(
  interests: string[],
  masteryBand: "beginner" | "intermediate" | "advanced"
): "clash_royale" | "yoga" | "generic" {
  if (masteryBand === "advanced") {
    return "generic";
  }

  for (const interest of interests) {
    const s = interest.toLowerCase();

    if (s.includes("clash")) return "clash_royale";
    if (s.includes("yoga")) return "yoga";
  }

  return "generic";
}

/**
 * Adaptive explanation builder.
 */
export function buildAdaptiveExplanation(
  concept: string,
  style: "clash_royale" | "yoga" | "generic",
  mastery: number,
  masteryBand: "beginner" | "intermediate" | "advanced"
): string {
  if (masteryBand === "beginner") {
    return buildBeginnerExplanation(concept, style);
  }

  if (masteryBand === "intermediate") {
    return buildIntermediateExplanation(concept, style);
  }

  return buildAdvancedExplanation(concept);
}

/**
 * Beginner explanations:
 * highly intuitive, analogy-first.
 */
function buildBeginnerExplanation(
  concept: string,
  style: "clash_royale" | "yoga" | "generic"
): string {
  if (style === "clash_royale") {
    return `Here's a simple way to think about it. **${concept}** is like a Clash Royale match: you want to understand who is directing the flow, what information is being shared, and how decisions are made from that. Focus first on the role it plays before worrying about the deeper mechanics.`;
  }

  if (style === "yoga") {
    return `Here's a simple way to think about it. **${concept}** is like learning a Yoga pose: first understand the base alignment, then the balance, then the small adjustments. Don’t try to memorize every detail at once—start with the core purpose of the concept.`;
  }

  return `Here's a simple way to think about it. **${concept}** has a basic role, a mechanism, and an effect. First ask: what is it used for, how does it work at a high level, and what changes because of it?`;
}

/**
 * Intermediate explanations:
 * mix analogy + technical meaning.
 */
function buildIntermediateExplanation(
  concept: string,
  style: "clash_royale" | "yoga" | "generic"
): string {
  if (style === "clash_royale") {
    return `You're probably past the very basic intuition, so here's the next layer. **${concept}** can be understood like a Clash Royale system where units react based on structured information and predefined rules. The important technical step is to connect the analogy back to the real mechanism: what data is exchanged, what decision rule is used, and what outcome that produces.`;
  }

  if (style === "yoga") {
    return `You already have some intuition, so now think of **${concept}** like progressing from the shape of a Yoga pose to the actual mechanics of balance and alignment. At this stage, focus on the internal mechanism: what inputs it uses, what process it follows, and how that affects the final result.`;
  }

  return `At this stage, think about **${concept}** less as a definition and more as a mechanism. Identify the inputs it depends on, the process it follows, and the output or decision it produces. That gives you a more technical understanding than just memorizing the term.`;
}

/**
 * Advanced explanations:
 * mostly technical, concise, less analogy-heavy.
 */
function buildAdvancedExplanation(concept: string): string {
  return `You probably already know this, but here's a quick refresher. **${concept}** should be understood in terms of its role, internal mechanism, and downstream effect. Focus on what state or data it depends on, what algorithm or rule it applies, and how that influences system behavior.`;
}