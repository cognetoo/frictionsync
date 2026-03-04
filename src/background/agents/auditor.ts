import { bumpMastery } from "../store/profileStore";
import type { UserProfile } from "../store/profileStore";

export type FeedbackEvent =
  | { type: "got_it"; t: number }
  | { type: "dismissed"; t: number };

export type AuditResult = {
  concept: string | null;
  updatedProfile: UserProfile | null;
  action: "mastery_increased" | "no_change";
  reason: string;
};

/**
 * Agent C: Auditor
 * Updates mastery memory based on user feedback.
 *
 * Strategy (v1):
 * - If user clicks "Got it", increment mastery by +1 for that concept.
 * - If dismissed, do nothing.
 */
export async function auditFeedback(
  feedback: FeedbackEvent,
  concept: string | null
): Promise<AuditResult> {
  if (!concept) {
    return {
      concept: null,
      updatedProfile: null,
      action: "no_change",
      reason: "No concept attached to feedback"
    };
  }

  if (feedback.type === "dismissed") {
    return {
      concept,
      updatedProfile: null,
      action: "no_change",
      reason: "User dismissed the help"
    };
  }

  if(feedback.type === "got_it"){
    const updated = await bumpMastery(concept, 1)
    return{
        concept,
        updatedProfile: updated,
        action: "mastery_increased",
        reason: "User confirmed understanding"
    }
  }

  return {
    concept,
    updatedProfile: null,
    action: "no_change",
    reason: "TODO not implemented"
  };
}