type HoverAnchor = {
  term: string;
  x: number;
  y: number;
};

type GhostOverlayPayload = {
  concept: string;
  explanation: string;
  anchor: HoverAnchor | null;
};

type GhostOverlayCallbacks = {
  onSimplified: () => void;
};

let ghostChipHost: HTMLDivElement | null = null;
let activeSentenceSpan: HTMLSpanElement | null = null;
let escapeHandler: ((e: KeyboardEvent) => void) | null = null;

/**
 * Show a small "Simplify" chip near the sentence closest to the last hover anchor.
 * Clicking it morphs the whole sentence into the simplified explanation.
 */
export function showGhostOverlay(
  payload: GhostOverlayPayload,
  cb: GhostOverlayCallbacks
) {
  cleanupGhostOverlay();

  const match = findBestSentenceMatch(payload.concept, payload.anchor);
  if (!match) return;

  const { textNode, sentenceStart, sentenceEnd } = match;
  const wrapped = wrapSentence(textNode, sentenceStart, sentenceEnd);
  if (!wrapped) return;

  activeSentenceSpan = wrapped;

  const rect = wrapped.getBoundingClientRect();

  ghostChipHost = document.createElement("div");
  ghostChipHost.id = "fs-ghost-chip";
  ghostChipHost.style.position = "fixed";
  ghostChipHost.style.left = `${Math.min(rect.right + 10, window.innerWidth - 150)}px`;
  ghostChipHost.style.top = `${Math.max(rect.top - 6, 10)}px`;
  ghostChipHost.style.zIndex = "2147483647";
  ghostChipHost.style.pointerEvents = "auto";

  const shadow = ghostChipHost.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    .chip {
      all: initial;
      box-sizing: border-box;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.96);
      color: #0f172a;
      border: 1px solid rgba(15, 23, 42, 0.08);
      box-shadow:
        0 14px 34px rgba(2, 6, 23, 0.16),
        0 6px 14px rgba(2, 6, 23, 0.08);
      backdrop-filter: blur(10px);
      cursor: pointer;
      transform: translateY(8px) scale(0.98);
      opacity: 0;
      transition:
        transform 150ms ease,
        opacity 150ms ease,
        box-shadow 150ms ease,
        background 150ms ease;
    }

    .chip.show {
      transform: translateY(0) scale(1);
      opacity: 1;
    }

    .chip:hover {
      box-shadow:
        0 16px 38px rgba(2, 6, 23, 0.18),
        0 8px 18px rgba(2, 6, 23, 0.10);
      background: rgba(255, 255, 255, 1);
    }

    .label {
      all: initial;
      font-family: inherit;
      font-size: 12px;
      font-weight: 700;
      color: #0369a1;
      letter-spacing: 0.01em;
    }

    .close {
      all: unset;
      cursor: pointer;
      width: 18px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      color: #475569;
      background: rgba(15,23,42,0.05);
      transition: background 120ms ease, color 120ms ease, transform 120ms ease;
    }

    .close:hover {
      background: rgba(15,23,42,0.15);
      color: #0f172a;
      transform: scale(1.05);
    }
  `;

  const chip = document.createElement("div");
  chip.className = "chip";
  chip.innerHTML = `
    <span class="label">✨ Simplify</span>
    <button class="close" title="Dismiss" aria-label="Dismiss">✕</button>
  `;

  shadow.appendChild(style);
  shadow.appendChild(chip);
  document.documentElement.appendChild(ghostChipHost);

  requestAnimationFrame(() => {
    chip.classList.add("show");
  });

  chip.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    if (target.classList.contains("close")) {
      cleanupGhostOverlay();
      return;
    }

    console.log("[FS] ghost simplify clicked", payload.concept);

    morphSentence(activeSentenceSpan, payload.explanation);
    cb.onSimplified();
    cleanupGhostChipOnly();
  });

  attachEscapeToClose();
}

/**
 * Remove chip and active sentence highlight.
 * Does not undo already-morphed sentence content.
 */
export function cleanupGhostOverlay() {
  cleanupGhostChipOnly();

  if (activeSentenceSpan) {
    activeSentenceSpan.style.background = "";
    activeSentenceSpan.style.borderRadius = "";
    activeSentenceSpan.style.padding = "";
    activeSentenceSpan.style.boxShadow = "";
    activeSentenceSpan = null;
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
 * Find the best matching sentence for the concept.
 * If anchor exists, choose the sentence nearest to that hover location.
 * Otherwise, fall back to the first matching visible sentence.
 */
function findBestSentenceMatch(
  concept: string,
  anchor: HoverAnchor | null
): {
  textNode: Text;
  sentenceStart: number;
  sentenceEnd: number;
} | null {
  const needle = concept.trim().toLowerCase();
  if (!needle) return null;

  if (anchor) {
    const direct = findSentenceFromAnchor(anchor, needle);
    if (direct) {
      const raw = direct.textNode.textContent || "";
      console.log(
        "[FS] anchor-based sentence match found for concept",
        concept,
        raw.slice(direct.sentenceStart, direct.sentenceEnd)
      );
      return direct;
    }
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Node | null;

  let bestMatch:
    | {
        textNode: Text;
        sentenceStart: number;
        sentenceEnd: number;
        distance: number;
      }
    | null = null;

  while ((node = walker.nextNode())) {
    const raw = node.textContent || "";
    const lower = raw.toLowerCase();

    const idx = lower.indexOf(needle);
    if (idx === -1) continue;

    const parent = node.parentElement;
    if (!parent) continue;

    const rect = parent.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    const bounds = getSentenceBounds(raw, idx);
    if (!bounds) continue;

    const distance = anchor ? distanceToRect(anchor.x, anchor.y, rect) : 0;

    if (!bestMatch || distance < bestMatch.distance) {
      bestMatch = {
        textNode: node as Text,
        sentenceStart: bounds.start,
        sentenceEnd: bounds.end,
        distance
      };
    }
  }

  if (!bestMatch) return null;

  const raw = bestMatch.textNode.textContent || "";
  console.log(
    "[FS] fallback sentence match found for concept",
    concept,
    raw.slice(bestMatch.sentenceStart, bestMatch.sentenceEnd)
  );

  return {
    textNode: bestMatch.textNode,
    sentenceStart: bestMatch.sentenceStart,
    sentenceEnd: bestMatch.sentenceEnd
  };
}

function findSentenceFromAnchor(
  anchor: HoverAnchor,
  concept: string
): {
  textNode: Text;
  sentenceStart: number;
  sentenceEnd: number;
} | null {
  console.log("[FS] trying anchor-based match", anchor, concept);

  const range =
    (document as any).caretRangeFromPoint?.(anchor.x, anchor.y) ??
    (document as any).caretPositionFromPoint?.(anchor.x, anchor.y);

  if (!range) return null;

  let textNode: Text | null = null;
  let offset = 0;

  if ((range as Range).startContainer) {
    const node = (range as Range).startContainer;
    if (node.nodeType === Node.TEXT_NODE) {
      textNode = node as Text;
      offset = (range as Range).startOffset;
    }
  }

  if (!textNode && (range as any).offsetNode) {
    const node = (range as any).offsetNode as Node;
    if (node.nodeType === Node.TEXT_NODE) {
      textNode = node as Text;
      offset = (range as any).offset ?? 0;
    }
  }

  if (!textNode) return null;

  const raw = textNode.textContent || "";
  const lower = raw.toLowerCase();

  let idx = lower.indexOf(concept, Math.max(0, offset - 20));
  if (idx === -1) idx = lower.indexOf(concept);
  if (idx === -1) return null;

  const bounds = getSentenceBounds(raw, idx);
  if (!bounds) return null;

  return {
    textNode,
    sentenceStart: bounds.start,
    sentenceEnd: bounds.end
  };
}

/**
 * Distance from a point to an element rect center.
 */
function distanceToRect(x: number, y: number, rect: DOMRect): number {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = x - cx;
  const dy = y - cy;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Expand around an index to sentence boundaries.
 */
function getSentenceBounds(text: string, conceptIndex: number): {
  start: number;
  end: number;
} | null {
  if (!text.trim()) return null;

  let start = conceptIndex;
  let end = conceptIndex;

  while (start > 0) {
    const ch = text[start - 1];
    if (ch === "." || ch === "!" || ch === "?" || ch === "\n") break;
    start--;
  }

  while (end < text.length) {
    const ch = text[end];
    if (ch === "." || ch === "!" || ch === "?" || ch === "\n") {
      end++;
      break;
    }
    end++;
  }

  while (start < text.length && /\s/.test(text[start])) start++;
  while (end > 0 && /\s/.test(text[end - 1])) end--;

  if (end <= start) return null;

  return { start, end };
}

/**
 * Wrap a full sentence in a span so we can morph it.
 */
function wrapSentence(
  textNode: Text,
  sentenceStart: number,
  sentenceEnd: number
): HTMLSpanElement | null {
  const text = textNode.textContent || "";
  const before = text.slice(0, sentenceStart);
  const sentence = text.slice(sentenceStart, sentenceEnd);
  const after = text.slice(sentenceEnd);

  const frag = document.createDocumentFragment();

  if (before) frag.appendChild(document.createTextNode(before));

  const span = document.createElement("span");
  span.textContent = sentence;
  span.style.background = "rgba(14, 165, 233, 0.10)";
  span.style.borderRadius = "10px";
  span.style.padding = "2px 5px";
  span.style.boxShadow = "inset 0 0 0 1px rgba(14, 165, 233, 0.12)";
  span.style.transition =
    "opacity 180ms ease, transform 180ms ease, background 180ms ease, box-shadow 180ms ease";
  frag.appendChild(span);

  if (after) frag.appendChild(document.createTextNode(after));

  const parent = textNode.parentNode;
  if (!parent) return null;

  parent.replaceChild(frag, textNode);
  return span;
}

/**
 * Morph the entire sentence into the simplified explanation.
 */
function morphSentence(target: HTMLSpanElement | null, explanation: string) {
  if (!target) return;

  target.style.opacity = "0";
  target.style.transform = "translateY(-2px) scale(0.995)";

  window.setTimeout(() => {
    target.textContent = stripMarkdown(explanation);
    target.style.background = "rgba(34, 197, 94, 0.12)";
    target.style.boxShadow = "inset 0 0 0 1px rgba(34, 197, 94, 0.16)";
    target.style.padding = "4px 6px";
    target.style.borderRadius = "10px";
    target.style.opacity = "1";
    target.style.transform = "translateY(0) scale(1)";
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