export type SensorEvent =
  | {
      type: "hover";
      term: string;
      ms: number;
      t: number;
      x: number;
      y: number;
      sentence?: string;
    }
  | { type: "backscroll"; count: number; t: number }
  | { type: "dwell"; paragraph: number; ms: number; t: number }
  | { type: "deadclick"; x: number; y: number; tag: string; t: number }
  | { type: "rageclick"; x: number; y: number; count: number; t: number };

type SensorCallback = (ev: SensorEvent) => void;

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were",
  "and", "or", "but", "if", "then", "else",
  "of", "to", "in", "on", "at", "by", "for", "from", "with", "as",
  "this", "that", "these", "those",
  "it", "its", "be", "been", "being",
  "do", "does", "did",
  "have", "has", "had",
  "can", "could", "will", "would", "should", "may", "might",
  "not", "no", "yes",
  "into", "over", "under", "about", "after", "before",
  "than", "so", "such", "also",
  "link", "like", "used", "using", "many"
]);

function normalizeHoverTerm(word: string): string {
  return word.trim().toLowerCase();
}

function isMeaningfulHoverTerm(word: string): boolean {
  const term = normalizeHoverTerm(word);

  if (term.length < 3) return false;
  if (STOP_WORDS.has(term)) return false;
  if (/^\d+$/.test(term)) return false;
  if (!/[a-z]/i.test(term)) return false;

  return true;
}

function extractSentenceFromText(fullText: string, word: string): string | null {
  const text = fullText.replace(/\s+/g, " ").trim();
  if (!text) return null;

  const lowerText = text.toLowerCase();
  const lowerWord = word.toLowerCase();

  const idx = lowerText.indexOf(lowerWord);
  if (idx === -1) return null;

  let start = idx;
  let end = idx + lowerWord.length;

  while (start > 0 && !/[.!?]/.test(text[start - 1])) {
    start--;
  }

  while (end < text.length && !/[.!?]/.test(text[end])) {
    end++;
  }

  if (end < text.length) end++;

  const sentence = text.slice(start, end).trim();

  if (!sentence) return null;
  if (sentence.length < 12) return null;

  return sentence.slice(0, 220);
}

/**
 * Starts observing page interaction signals.
 */
export function startSensor(cb: SensorCallback) {
  setupHoverSensor(cb);
  setupScrollSensor(cb);
  setupDwellSensor(cb);
  setupClickSensor(cb);
}

/**
 * Hover detection
 */
function setupHoverSensor(cb: SensorCallback) {
  let hoverStart = 0;
  let hoverWord = "";
  let hoverX = 0;
  let hoverY = 0;
  let hoverSentence: string | null = null;

  function getWordUnderPointer(e: MouseEvent): string {
    const range =
      (document as any).caretRangeFromPoint?.(e.clientX, e.clientY) ??
      (document as any).caretPositionFromPoint?.(e.clientX, e.clientY);

    if (!range) return "";

    if (range.startContainer) {
      const node = range.startContainer as Node;
      if (node.nodeType !== Node.TEXT_NODE) return "";

      const text = node.textContent ?? "";
      const offset = (range as Range).startOffset ?? 0;

      let l = offset;
      let r = offset;

      while (l > 0 && /\w/.test(text[l - 1])) l--;
      while (r < text.length && /\w/.test(text[r])) r++;

      const word = text.slice(l, r).trim();
      return word.length <= 40 ? word : "";
    }

    const node = (range as any).offsetNode as Node;
    if (!node || node.nodeType !== Node.TEXT_NODE) return "";

    const text = node.textContent ?? "";
    const offset = (range as any).offset ?? 0;

    let l = offset;
    let r = offset;

    while (l > 0 && /\w/.test(text[l - 1])) l--;
    while (r < text.length && /\w/.test(text[r])) r++;

    const word = text.slice(l, r).trim();
    return word.length <= 40 ? word : "";
  }

  document.addEventListener("mousemove", (e) => {
    const word = getWordUnderPointer(e);
    if (!word) return;

    const w = word.toLowerCase();

    if (w !== hoverWord) {
      hoverWord = w;
      hoverStart = Date.now();
      hoverX = e.clientX;
      hoverY = e.clientY;

      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const fullText = el?.innerText ?? "";
      hoverSentence = extractSentenceFromText(fullText, w);
    }
  });

  setInterval(() => {
    if (!hoverStart || !hoverWord) return;

    const ms = Date.now() - hoverStart;
    if (ms >= 1200) {
      const cleanTerm = normalizeHoverTerm(hoverWord);

      if (isMeaningfulHoverTerm(cleanTerm)) {
        console.log("[FS] hover word", cleanTerm, ms);
        console.log("[FS] hover anchor", cleanTerm, hoverX, hoverY);
        console.log("[FS] hover sentence", hoverSentence);

        cb({
          type: "hover",
          term: cleanTerm,
          ms,
          t: Date.now(),
          x: hoverX,
          y: hoverY,
          sentence: hoverSentence ?? undefined
        });
      } else {
        console.log("[FS] ignored weak hover term", cleanTerm, ms);
      }

      hoverStart = 0;
      hoverWord = "";
      hoverSentence = null;
    }
  }, 300);
}

/**
 * Backscroll detection
 */
function setupScrollSensor(cb: SensorCallback) {
  let lastY = window.scrollY;
  let backscrollCount = 0;
  let lastEmit = 0;

  window.addEventListener(
    "scroll",
    () => {
      const currentY = window.scrollY;
      const now = Date.now();

      if (currentY < lastY) {
        if (now - lastEmit > 300) {
          backscrollCount++;
          lastEmit = now;
        }
      }

      lastY = currentY;

      if (backscrollCount >= 2) {
        cb({ type: "backscroll", count: backscrollCount, t: Date.now() });
        backscrollCount = 0;
      }
    },
    { passive: true }
  );
}

/**
 * Dwell detection
 */
function setupDwellSensor(cb: SensorCallback) {
  let start = Date.now();

  setInterval(() => {
    const ms = Date.now() - start;

    if (ms > 30000) {
      cb({
        type: "dwell",
        paragraph: 0,
        ms,
        t: Date.now()
      });

      start = Date.now();
    }
  }, 5000);
}

function setupClickSensor(cb: SensorCallback) {
  const recentClicks: Array<{ x: number; y: number; t: number }> = [];

  let lastUrl = location.href;
  let suppressDeadClickUntil = 0;

  window.addEventListener("popstate", () => {
    suppressDeadClickUntil = Date.now() + 800;
    lastUrl = location.href;
  });

  window.addEventListener("hashchange", () => {
    suppressDeadClickUntil = Date.now() + 800;
    lastUrl = location.href;
  });

  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const x = e.clientX;
    const y = e.clientY;
    const now = Date.now();
    const tag = target.tagName.toLowerCase();

    recentClicks.push({ x, y, t: now });

    while (recentClicks.length > 0 && now - recentClicks[0].t > 1200) {
      recentClicks.shift();
    }

    const nearbyClicks = recentClicks.filter((c) => {
      const dx = c.x - x;
      const dy = c.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return dist < 30;
    });

    if (nearbyClicks.length >= 3) {
      console.log("[FS] rage click detected", {
        x,
        y,
        count: nearbyClicks.length
      });

      cb({
        type: "rageclick",
        x,
        y,
        count: nearbyClicks.length,
        t: now
      });

      recentClicks.length = 0;
      return;
    }

    const interactive = !!target.closest(
      "a, button, input, textarea, select, summary, label, [role='button'], [role='link'], details"
    );
    if (interactive) return;

    const editable = !!target.closest(
      "input, textarea, [contenteditable='true'], [contenteditable='']"
    );
    if (editable) return;

    const selection = window.getSelection()?.toString().trim() ?? "";
    if (selection.length > 0) return;

    if (now < suppressDeadClickUntil) return;

    window.setTimeout(() => {
      const activeTag = document.activeElement?.tagName?.toLowerCase() ?? "";

      const focusMovedMeaningfully =
        activeTag === "input" ||
        activeTag === "textarea" ||
        activeTag === "select" ||
        document.activeElement?.getAttribute("contenteditable") === "true";

      const urlChanged = location.href !== lastUrl;

      if (focusMovedMeaningfully || urlChanged) {
        lastUrl = location.href;
        return;
      }

      console.log("[FS] dead click detected", {
        x,
        y,
        tag
      });

      cb({
        type: "deadclick",
        x,
        y,
        tag,
        t: now
      });
    }, 250);
  });
}