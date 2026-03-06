import { startSensor, type SensorEvent } from "./sensor";
import { showBubble } from "./ui/bubble"

/**
 * Send a sensor event to background.
 */
function sendSignal(ev: SensorEvent) {
  chrome.runtime.sendMessage({ type: "FS_SIGNAL", payload: ev }).catch(() => {});
  console.log("[FS] signal", ev);
}

/**
 * Start collecting behavior signals.
 */
startSensor(sendSignal);

/**
 * Listen for interventions from background (Agent B output).
 * Background sends: { type: "FS_INTERVENTION", payload: TutorResponse }
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

  // Show the UI bubble and wire feedback callbacks.
  showBubble(payload, {
  onGotIt: () => {
  chrome.runtime.sendMessage({
    type: "FS_FEEDBACK",
    payload: {
      type: "got_it",
      t: Date.now(),
      concept: payload.concept
    }
  });
},
onDismiss: () => {
  chrome.runtime.sendMessage({
    type: "FS_FEEDBACK",
    payload: {
      type: "dismissed",
      t: Date.now(),
      concept: payload.concept
    }
  });
}
  });
});