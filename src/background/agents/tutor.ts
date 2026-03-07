import type { UserProfile } from "../store/profileStore";

import { fetchTutorExplanation } from "./tutorClient";

export type TutorRequest = {
  concept: string;
  pageTitle?: string;
  contextTerms?: string[];
  sentenceContext?: string;
};

export type TutorResponse = {
  title: string;
  body: string;
  cta: string;
  concept: string;
  styleTag: string;
  masteryBand: "beginner" | "intermediate" | "advanced";
  source: "ai" | "fallback";
};

const TUTOR_API_BASE_URL = "https://frictionsync.onrender.com";

/**
 * Tutor v3
 * AI-ready hybrid tutor:
 * - tries AI generation
 * - falls back to deterministic Tutor v2 if AI is unavailable
 */
export async function tutor(
  req: TutorRequest,
  profile: UserProfile
): Promise<TutorResponse> {
  const concept = normalizeConcept(req.concept);
  const mastery = profile.mastery[concept] ?? 0;
  const masteryBand = getMasteryBand(mastery);

  const title =
    masteryBand === "advanced"
      ? `Quick check: ${concept}`
      : `Quick help: ${concept}`;

  // AI path
  const aiBody = await tryGenerateWithAI({
    concept,
    interests: profile.interests,
    mastery,
    masteryBand,
    pageTitle: req.pageTitle,
    contextTerms: req.contextTerms,
    sentenceContext: req.sentenceContext
  });

  if (aiBody) {
    return {
      title,
      body: aiBody,
      cta: "Got it!",
      concept,
      styleTag: "ai_dynamic",
      masteryBand,
      source: "ai"
    };
  }

  // Fallback path
  const fallbackStyle = pickFallbackStyle(profile.interests, masteryBand);
  const fallbackBody = buildFallbackExplanation(
    concept,
    fallbackStyle,
    masteryBand
  );

  return {
    title,
    body: fallbackBody,
    cta: "Got it!",
    concept,
    styleTag: fallbackStyle,
    masteryBand,
    source: "fallback"
  };
}

/**
 * Normalize concept text.
 */
export function normalizeConcept(c: string): string {
  return c.trim().toLowerCase().slice(0, 80);
}

/**
 * Convert mastery score into a learning stage.
 */
export function getMasteryBand(
  mastery: number
): "beginner" | "intermediate" | "advanced" {
  if (mastery <= 2) return "beginner";
  if (mastery <= 5) return "intermediate";
  return "advanced";
}

/**
 * Prompt input for future AI generation.
 */
type TutorAIInput = {
  concept: string;
  interests: string[];
  mastery: number;
  masteryBand: "beginner" | "intermediate" | "advanced";
  pageTitle?: string;
  contextTerms? : string[];
  sentenceContext?: string;
};

/**
 * AI stub:
 * For now returns null so fallback is used.
 * Later this will call a serverless/backend endpoint or local model.
 */
async function tryGenerateWithAI(input: TutorAIInput): Promise<string | null> {
  const prompt = buildTutorPrompt(input);

  console.log("[FS] tutor v3 AI prompt", prompt);

  console.log("[FS] calling tutor API",{
    concept: input.concept,
    masteryBand: input.masteryBand,
    interests: input.interests,
    pageTitle: input.pageTitle,
    contextTerms: input.contextTerms ?? [],
    sentenceContext: input.sentenceContext ?? null
  });

  const body = await fetchTutorExplanation(TUTOR_API_BASE_URL,{
    concept:input.concept,
    interests:input.interests,
    mastery: input.mastery,
    masteryBand: input.masteryBand,
    pageTitle: input.pageTitle,
    contextTerms: input.contextTerms ?? [],
    sentenceContext: input.sentenceContext
  });
  if (body){
    console.log("[FS] tutor AI generation succeeded");
    return body;
  }
  console.log("[FS] tutor AI generation unavailable, using fallback")
  return null;
}

/**
 * Build the future AI prompt.
 * This is the key part of Tutor v3 design.
 */
export function buildTutorPrompt(input: TutorAIInput): string {

const contextTerms = input.contextTerms && input.contextTerms.length > 0 ? 
  input.contextTerms.join(", ") : "none";

  const interests =
    input.interests.length > 0 ? input.interests.join(", ") : "none provided";

  const sentenceContext = input.sentenceContext ?? "none";

  return [
    "You are an adaptive tutor inside a browser extension.",
    `Concept: ${input.concept}`,
    `Mastery score: ${input.mastery}`,
    `Mastery band: ${input.masteryBand}`,
    `User interests: ${interests}`,
    `Page title: ${input.pageTitle ?? "unknown"}`,
    `Context terms: ${contextTerms}`,
    `Sentence context: ${sentenceContext}`,
    "",
    "Instructions:",
    "- Explain the concept at the user's current mastery level.",
    "- For beginner: use simple intuition and optionally one of the user's interests.",
    "- For intermediate: combine intuition with mechanism.",
    "- For advanced: be concise and technical, and reduce analogy use.",
    "- Do not over-explain.",
    "- Keep the answer to 2-4 sentences.",
    "- Make it specific to the concept, not generic filler.",
    "- Prefer the most natural user interest if one helps.",
    "- Avoid markdown headings or bullet points.",
    "- Avoid choosing trivial or generic comparisions if they do not help understanding."
  ].join("\n");
}

/**
 * Deterministic fallback style selection.
 */
function pickFallbackStyle(
  interests: string[],
  masteryBand: "beginner" | "intermediate" | "advanced"
): "clash_royale" | "yoga" | "generic" {
  if (masteryBand === "advanced") return "generic";

  for (const interest of interests) {
    const s = interest.toLowerCase();

    if (s.includes("clash")) return "clash_royale";
    if (s.includes("yoga")) return "yoga";
  }

  return "generic";
}

/**
 * Deterministic fallback explanation generator.
 */
function buildFallbackExplanation(
  concept: string,
  style: "clash_royale" | "yoga" | "generic",
  masteryBand: "beginner" | "intermediate" | "advanced"
): string {
  if (masteryBand === "beginner") {
    if (style === "clash_royale") {
      return `Here’s a simple way to think about it. **${concept}** is like a Clash Royale system where decisions depend on shared information and a clear rule for what to do next. Start by understanding its role before going into the deeper mechanics.`;
    }

    if (style === "yoga") {
      return `Here’s a simple way to think about it. **${concept}** is like learning a Yoga pose: first understand the purpose, then the balance, then the adjustments. Start with what it does before trying to memorize all the internal details.`;
    }

    return `Here’s a simple way to think about it. **${concept}** can be understood through its purpose, its mechanism, and its effect. First ask what it is used for, then how it works at a high level, then what changes because of it.`;
  }

  if (masteryBand === "intermediate") {
    if (style === "clash_royale") {
      return `You already have some intuition, so take the next step. **${concept}** is like a structured Clash Royale system where the important question is what information is exchanged, what rule is applied, and what decision that produces. Connect the analogy back to the real mechanism.`;
    }

    if (style === "yoga") {
      return `You already have the basic feel for it, so now focus on the mechanism behind **${concept}**. Think of it like moving from the shape of a Yoga pose to understanding balance, alignment, and correction.`;
    }

    return `At this stage, think of **${concept}** as a mechanism, not just a definition. Identify what inputs it depends on, what process or rule it applies, and what output or decision it produces.`;
  }

  return `You probably already know this, but here’s a quick refresher. **${concept}** should be understood in terms of its role, internal mechanism, and downstream effect. Focus on what state or data it depends on, what rule or algorithm it applies, and how that influences system behavior.`;
}