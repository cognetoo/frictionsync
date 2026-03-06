import { addSignal, getContext, clearTab, type Signal } from "./store/signalBuffer";
import { getProfile } from "./store/profileStore";
import { observe } from "./agents/observer";
import { tutor } from "./agents/tutor";
import { auditFeedback, type FeedbackEvent } from "./agents/auditor";

// Memory: last concept we intervened with per tab.
// (Not persisted; just in-memory for current browser session)

const lastConceptByTab = new Map<number, string>();

const lastInterventionTime = new Map<number, number>();

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

      // Run Agent B (Tutor) to generate a response
      const response = tutor({ concept: decision.concept }, profile);
      console.log("[FS] tutor response", response);

      // Remember last concept for this tab (so feedback updates correct mastery)
      lastConceptByTab.set(tabId, response.concept);

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

      console.log("[FS] audit result", audit);

      sendResponse({ ok: true, audit });
      return;
    }

    // ---- 3) TAB CLEAR: optional cleanup hook if we decide to call it later
    if (msg?.type === "FS_CLEAR_TAB") {
      clearTab(tabId);
      lastConceptByTab.delete(tabId);
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
});