import { startSensor, type SensorEvent } from "./sensor";
import { showBubble } from "./ui/bubble";
import { showGhostOverlay } from "./ui/ghostOverlay";
import { getProfile } from "../background/store/profileStore";

// Prevent duplicate initialization on the same page
if ((window as any).__FS_LOADED__) {
  console.log("[FS] already loaded, skipping");
} else {
  (window as any).__FS_LOADED__ = true;
  type HoverAnchor = {
    term: string;
    x: number;
    y: number;
  };

  let lastHoverAnchor: HoverAnchor | null = null;

  /**
   * Safe message sender.
   * Avoids throwing if extension was reloaded and old content script is still on page.
   */
  function safeSendMessage(message: any) {
    try {
      chrome.runtime.sendMessage(message).catch(() => {});
    } catch {
      // Extension context invalidated after reload; ignore
    }
  }

  /**
   * Send a sensor event to background.
   */
  function sendSignal(ev: SensorEvent) {
    if(ev.type === "hover"){
        lastHoverAnchor = {
            term: ev.term,
            x: ev.x,
            y: ev.y
        };

        console.log("[FS] stored hover anchor",lastHoverAnchor);
    }
    safeSendMessage({ type: "FS_SIGNAL", payload: ev });
    console.log("[FS] signal", ev);
  }

  /**
   * Start collecting signals.
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
    console.log("[FS] showing bubble for concept", payload.concept);

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

    // 2) Ghost overlay only if enabled in settings
    (async () => {
      const profile = await getProfile();

      if (!profile.ghostOverlayEnabled) {
        console.log("[FS] ghost overlay disabled in settings");
        return;
      }

      console.log("[FS] showing ghost overlay for concept", payload.concept);

      showGhostOverlay(
        {
          concept: payload.concept,
          explanation: payload.body,
          anchor: lastHoverAnchor
        },
        {
          onSimplified: () => {
            console.log("[FS] ghost overlay sending feedback for", payload.concept);

            safeSendMessage({
              type: "FS_FEEDBACK",
              payload: {
                type: "got_it",
                t: Date.now(),
                concept: payload.concept
              }
            });
          }
        }
      );
    })();
  });
}