import type { UserProfile } from "../store/profileStore";

export type TutorRequest = {
  concept: string;     // chosen by Agent A
  pageTitle?: string;  
};

export type TutorResponse = {
  title: string;
  body: string;
  cta: string;
  concept: string;
  styleTag: string; // for debugging: "clash_royale" / "yoga" / "generic"
};

/**
 * Agent B: Tutor
 * Generates a personalized analogy/explanation using user interests.
 */
export function tutor(req: TutorRequest, profile: UserProfile): TutorResponse {
  const concept = normalizeConcept(req.concept);

  // Choose a teaching "style" based on interests.
  const style = pickStyle(profile.interests);

  // If already mastered, reduce interruptions (more in Agent A/C later).
  const mastery = profile.mastery[concept] ?? 0;

  const title = mastery >= 5
    ? `Quick check: ${concept}`
    : `Quick help: ${concept}`;

  const body = buildAnalogy(concept, style, mastery);

  return {
    title,
    body,
    cta: "Got it!",
    concept,
    styleTag: style
  };
}

/**
 * Normalize concept text to a stable key.
 */
export function normalizeConcept(c: string): string {
  return c.trim().toLowerCase().slice(0, 60);
}

export function pickStyle(interests: string[]): "clash_royale" | "yoga" | "generic" {
  
  for (const i of interests){
    const s = i.toLowerCase()
    if (s.includes("clash")) return "clash_royale"
    if (s.includes("yoga")) return "yoga"
  }
  return "generic";
}

/**
 * Core response generator.
 * In v1: deterministic templates.
 * In v2: swap this function to call Gemini Nano / Serverless LLM.
 */
export function buildAnalogy(
  concept: string,
  style: "clash_royale" | "yoga" | "generic",
  mastery: number
): string {
  const prefix = mastery >= 5
    ? "You probably already know this, but here’s a quick refresher."
    : "Here’s a simple way to think about it.";

  if (style === "clash_royale") {
    return `${prefix} **${concept}** is like a Clash Royale match: when something "redirects" traffic, it’s like your Hog Rider getting pulled to a building instead of the tower. The key is: who controls the direction and why.`;
  }

  if (style === "yoga") {
    return `${prefix} **${concept}** is like learning a Yoga pose: if you keep falling out of balance, you step back to a simpler alignment cue. Focus on the core idea first, then add the details.`;
  }

  return `${prefix} **${concept}** means there’s a core mechanism happening. Break it into: (1) what the goal is, (2) what changes, and (3) what the impact is.`;
}