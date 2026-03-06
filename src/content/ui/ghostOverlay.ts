type GhostOverlayPayload = {
  concept: string;
  explanation: string;
};

type GhostOverlayCallbacks = {
  onSimplified: () => void;
};

let ghostChipHost: HTMLDivElement | null = null;
let activeReplacementSpan: HTMLSpanElement | null = null;
let escapeHandler: ((e: KeyboardEvent) => void) | null = null;

/**
 * Show a small "Simplify" chip near the first matching concept occurrence.
 * Clicking it morphs the matched text into the simplified explanation.
 */
export function showGhostOverlay(
  payload: GhostOverlayPayload,
  cb: GhostOverlayCallbacks
) {
  cleanupGhostOverlay();

  const match = findConceptTextMatch(payload.concept);
  if (!match) return;

  const { textNode, start, end } = match;
  const wrapped = wrapMatchedText(textNode, start, end);
  if (!wrapped) return;

  activeReplacementSpan = wrapped;

  const rect = wrapped.getBoundingClientRect();

  ghostChipHost = document.createElement("div");
  ghostChipHost.id = "fs-ghost-chip";
  ghostChipHost.style.position = "fixed";
  ghostChipHost.style.left = `${Math.min(rect.right + 8, window.innerWidth - 120)}px`;
  ghostChipHost.style.top = `${Math.max(rect.top - 4, 8)}px`;
  ghostChipHost.style.zIndex = "2147483647";
  ghostChipHost.style.pointerEvents = "auto";

  const shadow = ghostChipHost.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    .chip {
      all: initial;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #38bdf8;
      color: #082f49;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 8px 20px rgba(0,0,0,0.2);
    }

    .chip:hover {
      filter: brightness(0.96);
    }

    .close {
      all: unset;
      cursor: pointer;
      font-size: 12px;
      line-height: 1;
      opacity: 0.75;
    }
  `;

  const chip = document.createElement("div");
  chip.className = "chip";
  chip.innerHTML = `
    <span>Simplify</span>
    <button class="close" title="Dismiss">✕</button>
  `;

  shadow.appendChild(style);
  shadow.appendChild(chip);
  document.documentElement.appendChild(ghostChipHost);

  chip.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    if (target.classList.contains("close")) {
      cleanupGhostOverlay();
      return;
    }

    console.log("[FS] ghost simplify clicked", payload.concept);

    morphText(activeReplacementSpan, payload.explanation);

   //feedback
    cb.onSimplified();

    cleanupGhostChipOnly();
  });

  attachEscapeToClose();
}

/**
 * Removes chip + restores listeners.
 * Does NOT undo morphed text.
 */
export function cleanupGhostOverlay() {
  cleanupGhostChipOnly();

  if (activeReplacementSpan) {
    activeReplacementSpan.style.background = "";
    activeReplacementSpan.style.borderRadius = "";
    activeReplacementSpan.style.padding = "";
    activeReplacementSpan = null;
  }
}

function cleanupGhostChipOnly() {
  if (escapeHandler) {
    document.removeEventListener("keydown", escapeHandler);
    escapeHandler = null;
  }

  if (ghostChipHost) {
    ghostChipHost.remove();
    ghostChipHost = null;
  }
}

/**
 * Find first text-node match of concept in the page.
 */
function findConceptTextMatch(concept: string): {
  textNode: Text;
  start: number;
  end: number;
} | null {
  const needle = concept.trim().toLowerCase();
  if (!needle) return null;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const raw = node.textContent || "";
    const lower = raw.toLowerCase();

    const idx = lower.indexOf(needle);
    if (idx === -1) continue;

    const parent = node.parentElement;
    if (!parent) continue;

    const rect = parent.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    return {
      textNode: node as Text,
      start: idx,
      end: idx + needle.length
    };
  }

  return null;
}

/**
 * Wrap the matched substring in a span so we can morph it.
 */
function wrapMatchedText(textNode: Text, start: number, end: number): HTMLSpanElement | null {
  const text = textNode.textContent || "";
  const before = text.slice(0, start);
  const match = text.slice(start, end);
  const after = text.slice(end);

  const frag = document.createDocumentFragment();

  if (before) frag.appendChild(document.createTextNode(before));

  const span = document.createElement("span");
  span.textContent = match;
  span.style.background = "rgba(56, 189, 248, 0.18)";
  span.style.borderRadius = "4px";
  span.style.padding = "0 2px";
  span.style.transition = "opacity 180ms ease, transform 180ms ease, background 180ms ease";
  frag.appendChild(span);

  if (after) frag.appendChild(document.createTextNode(after));

  const parent = textNode.parentNode;
  if (!parent) return null;

  parent.replaceChild(frag, textNode);
  return span;
}

/**
 * Morph the matched text into simplified explanation.
 */
function morphText(target: HTMLSpanElement | null, explanation: string) {
  if (!target) return;

  target.style.opacity = "0";
  target.style.transform = "translateY(-2px)";

  window.setTimeout(() => {
    target.textContent = stripMarkdown(explanation);
    target.style.background = "rgba(34, 197, 94, 0.14)";
    target.style.padding = "2px 4px";
    target.style.opacity = "1";
    target.style.transform = "translateY(0)";
  }, 180);
}

function stripMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1");
}

function attachEscapeToClose() {
  escapeHandler = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    cleanupGhostOverlay();
  };

  document.addEventListener("keydown", escapeHandler);
}