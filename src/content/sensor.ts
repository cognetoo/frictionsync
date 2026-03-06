export type SensorEvent =
  | { type: "hover"; term: string; ms: number; t: number }
  | { type: "backscroll"; count: number; t: number }
  | { type: "dwell"; paragraph: number; ms: number; t: number };

type SensorCallback = (ev: SensorEvent) => void;

/**
 * Starts observing page interaction signals.
 */

//cb is a function that takes a sensor event input. So this function in content.ts is sendSignal function
export function startSensor(cb: SensorCallback) {

  setupHoverSensor(cb);
  setupScrollSensor(cb);
  setupDwellSensor(cb);

}

/**
 * Hover detection
 */
function setupHoverSensor(cb: SensorCallback) {
  let hoverStart = 0;
  let hoverWord = "";

  function getWordUnderPointer(e: MouseEvent): string {
    const range =
      (document as any).caretRangeFromPoint?.(e.clientX, e.clientY) ??
      (document as any).caretPositionFromPoint?.(e.clientX, e.clientY);

    if (!range) return "";

    // caretRangeFromPoint returns a Range
    if (range.startContainer) {
      const node = range.startContainer as Node;
      if (node.nodeType !== Node.TEXT_NODE) return "";

      const text = node.textContent ?? "";
      const offset = (range as Range).startOffset ?? 0;

      // expand left/right to capture the word at offset
      let l = offset;
      let r = offset;

      while (l > 0 && /\w/.test(text[l - 1])) l--;
      while (r < text.length && /\w/.test(text[r])) r++;

      const word = text.slice(l, r).trim();
      return word.length <= 40 ? word : "";
    }

    // caretPositionFromPoint returns {offsetNode, offset}
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

    // If the hovered word changed, restart timer
    if (w !== hoverWord) {
      hoverWord = w;
      hoverStart = Date.now();
    }
  });

  // Every 300ms check if user has stayed on the same word long enough
  setInterval(() => {
    if (!hoverStart || !hoverWord) return;

    const ms = Date.now() - hoverStart;
    if (ms >= 1200) {
      console.log("[FS] hover word", hoverWord, ms);

      cb({
        type: "hover",
        term: hoverWord,
        ms,
        t: Date.now()
      });

      // prevent spamming: reset so it fires once per stable hover
      hoverStart = 0;
      hoverWord = "";
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

  window.addEventListener("scroll", () => {
    const currentY = window.scrollY;
    const now = Date.now();

    if (currentY < lastY) {
      // count "up move" only once per 300ms
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
  }, { passive: true });
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