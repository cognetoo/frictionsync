import { addSignal, getContext, clearTab, type Signal } from "./store/signalBuffer";
import { getProfile } from "./store/profileStore";
import { observe } from "./agents/observer";
import { tutor } from "./agents/tutor";
import { auditFeedback, type FeedbackEvent } from "./agents/auditor";

// Memory: last concept we intervened with per tab.
// (Not persisted; just in-memory for current browser session)

const lastConceptByTab = new Map<number, string>();

const lastInterventionTime = new Map<number, number>();

const lastExplainedConceptByTab = new Map<number, string>();

const lastConceptExplainTimeByTab = new Map<number, number>();

const  lastResolvedConceptByTab = new Map<number, string>();

const lastResolvedConceptTimeByTab = new Map<number, number>();

const SAME_CONCEPT_SUPPRESSION_MS = 30000;

const RESOLVED_CONCEPT_SUPPRESSION_MS = 60000;

  function buildTutorContextTerms(
    hoverTerms: string[],
    concept: string,
    limit = 4
  ): string[] {
    const normalizedConcept = concept.trim().toLowerCase();
    const seen = new Set<string>();
    const out: string[] = [];

    // walk from most recent to older
    for (let i = hoverTerms.length - 1; i >= 0; i--) {
      const term = hoverTerms[i].trim().toLowerCase();

      if (!term) continue;
      if (term === normalizedConcept) continue;
      if (seen.has(term)) continue;

      seen.add(term);
      out.push(term);

      if (out.length >= limit) break;
    }

    return out;
  }

/**
 * Helper: send intervention to a specific tab's content script.
 */
async function sendIntervention(tabId: number, payload: any) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "FS_INTERVENTION", payload });
  } catch {
    
  }
}

/**
 * Message handler: receives signals + feedback from content scripts.
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[FS] onMessage fired in background", msg);
  (async () => {
    // ---- Safety: messages must come from a tab
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ ok: false, error: "No tabId" });
      return;
    }

    console.log("[FS] background service worker loaded");

    // ---- 1) SIGNALS: content script sends learning friction signals
    if (msg?.type === "FS_SIGNAL") {
      console.log("[FS] FS_SIGNAL branch entered", msg.payload);
      const signal: Signal = msg.payload;

      // Load user identity memory (enabled + interests + mastery)
      const profile = await getProfile();
      if (!profile.enabled) {
        sendResponse({ ok: true, ignored: "disabled" });
        return;
      }

      // Store signal in short-term memory
      addSignal(tabId, signal);

      // Build summarized context for the Observer
      const ctx = getContext(tabId);

      console.log("[FS] got signal", { tabId, signal });
      console.log("[FS] ctx", getContext(tabId));

      // Run Agent A (Observer)
      const decision = observe(ctx);

      console.log("[FS] observer decision", decision);

      // If no intervention needed, stop.
      if (!decision.shouldIntervene || !decision.concept) {
        sendResponse({ ok: true, decision });
        return;
      }

      const now = Date.now();
      const last = lastInterventionTime.get(tabId) ?? 0;

    if (now - last < 15000) {
    console.log("[FS] intervention skipped due to cooldown", {
        tabId,
        concept: decision.concept,
        waitMsRemaining: 15000 - (now - last)
    });
    sendResponse({ ok: true, skipped: "cooldown" });
    return;
    }

    const lastExplainedConcept = lastExplainedConceptByTab.get(tabId) ?? null;
    const lastConceptTime = lastConceptExplainTimeByTab.get(tabId) ?? 0;

    if (
      lastExplainedConcept === decision.concept &&
      now - lastConceptTime < SAME_CONCEPT_SUPPRESSION_MS
    ) {
      console.log("[FS] skipping repeated explanation for same concept", {
        tabId,
        concept: decision.concept,
        waitMsRemaining: SAME_CONCEPT_SUPPRESSION_MS - (now - lastConceptTime)
      });

      sendResponse({ ok: true, skipped: "same_concept_suppressed" });
      return;
    }

    const lastResolvedConcept = lastResolvedConceptByTab.get(tabId) ?? null;
const lastResolvedTime = lastResolvedConceptTimeByTab.get(tabId) ?? 0;

  if (
    lastResolvedConcept === decision.concept &&
    now - lastResolvedTime < RESOLVED_CONCEPT_SUPPRESSION_MS
  ) {
    console.log("[FS] skipping recently resolved concept", {
      tabId,
      concept: decision.concept,
      waitMsRemaining: RESOLVED_CONCEPT_SUPPRESSION_MS - (now - lastResolvedTime)
    });

    sendResponse({ ok: true, skipped: "recently_resolved_suppressed" });
    return;
  }

      // Run Agent B (Tutor) to generate a response
      const pageTitle = sender.tab?.title ?? undefined;
      const contextTerms = buildTutorContextTerms(ctx.hoverTerms, decision.concept);
      const response = await tutor({ concept: decision.concept }, profile);
      console.log("[FS] tutor response", response);

      // Remember last concept for this tab (so feedback updates correct mastery)
      lastConceptByTab.set(tabId, response.concept);
      lastExplainedConceptByTab.set(tabId,response.concept);
      lastConceptExplainTimeByTab.set(tabId,now);

      // Send intervention bubble to content script UI
      await sendIntervention(tabId, response);

      lastInterventionTime.set(tabId, now);
      clearTab(tabId);

      sendResponse({ ok: true, decision, response });
      return;
    }

    // ---- 2) FEEDBACK: content script bubble sends user action ("Got it", dismissed)
    if (msg?.type === "FS_FEEDBACK") {
    const feedback = msg.payload as FeedbackEvent & { concept?: string };
    const concept = feedback.concept ?? lastConceptByTab.get(tabId) ?? null;


      console.log("[FS] feedback", { tabId, feedback, concept });

      // Run Agent C (Auditor) to update mastery
      const audit = await auditFeedback(feedback, concept);
      
    if (feedback.type === "got_it" && concept) {
      const now = Date.now();

      lastExplainedConceptByTab.set(tabId, concept);
      lastConceptExplainTimeByTab.set(tabId, now);

      lastResolvedConceptByTab.set(tabId, concept);
      lastResolvedConceptTimeByTab.set(tabId, now);
    }
      console.log("[FS] audit result", audit);

      sendResponse({ ok: true, audit });
      return;
    }

    // ---- 3) TAB CLEAR: optional cleanup hook if we decide to call it later
    if (msg?.type === "FS_CLEAR_TAB") {
      clearTab(tabId);
      lastConceptByTab.delete(tabId);
      lastInterventionTime.delete(tabId);
      lastExplainedConceptByTab.delete(tabId);
      lastConceptExplainTimeByTab.delete(tabId);
      lastResolvedConceptByTab.delete(tabId);
      lastResolvedConceptTimeByTab.delete(tabId);
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, error: "Unknown message type" });
  })();

  // keep message channel open for async
  return true;
});

/**
 * Clear memory when a tab is closed (prevents memory growth).
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  clearTab(tabId);
  lastConceptByTab.delete(tabId);
  lastInterventionTime.delete(tabId);
  lastExplainedConceptByTab.delete(tabId);
  lastConceptExplainTimeByTab.delete(tabId);
  lastResolvedConceptByTab.delete(tabId);
  lastResolvedConceptTimeByTab.delete(tabId);
});