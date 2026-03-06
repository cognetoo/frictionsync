import { startSensor, type SensorEvent } from "./sensor";
import { showBubble } from "./ui/bubble";
import { showGhostOverlay } from "./ui/ghostOverlay";

// Prevent duplicate initialization on the same page
if ((window as any).__FS_LOADED__) {
  console.log("[FS] already loaded, skipping");
} else {
  (window as any).__FS_LOADED__ = true;

  /**
   * Safe message sender.
   * Avoids throwing if extension was reloaded and old content script is still on page.
   */
  function safeSendMessage(message: any) {
    try {
      chrome.runtime.sendMessage(message).catch(() => {});
    } catch {

    }
  }

  /**
   * Send a sensor event to background.
   */
  function sendSignal(ev: SensorEvent) {
    safeSendMessage({ type: "FS_SIGNAL", payload: ev });
    console.log("[FS] signal", ev);
  }

  /**
   * Starts collecting signals.
   */
  startSensor(sendSignal);

  /**
   * Listen for interventions from background (Agent B output).
   */
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== "FS_INTERVENTION") return;

    const payload = msg.payload as {
      title: string;
      body: string;
      cta: string;
      concept: string;
      styleTag: string;
    };

    console.log("[FS] intervention", payload);

    // 1) Main floating bubble
    showBubble(payload, {
      onGotIt: () => {
        safeSendMessage({
          type: "FS_FEEDBACK",
          payload: {
            type: "got_it",
            t: Date.now(),
            concept: payload.concept
          }
        });
      },
      onDismiss: () => {
        safeSendMessage({
          type: "FS_FEEDBACK",
          payload: {
            type: "dismissed",
            t: Date.now(),
            concept: payload.concept
          }
        });
      }
    });

    // 2) Inline ghost overlay near matching concept text
    console.log("[FS] showing ghost overlay for concept", payload.concept);
    
   showGhostOverlay(
  {
    concept: payload.concept,
    explanation: payload.body
  },
  {
    onSimplified: () => {
      safeSendMessage({
        type: "FS_FEEDBACK",
        payload: {
          type: "got_it",
          t: Date.now(),
          concept: payload.concept
        }
      });
      console.log("[FS] ghost overlay sending feedback for", payload.concept);
    }
  }
);
});
}