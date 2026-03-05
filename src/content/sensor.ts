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
  let hoverTerm = "";

  document.addEventListener("mouseover", (e) => {

    const el = e.target as HTMLElement;

    const text = el.innerText?.trim();
    if (!text) return;

    hoverTerm = text.slice(0, 40);
    hoverStart = Date.now();

  });

  document.addEventListener("mouseout", () => {

    if (!hoverStart) return;

    const ms = Date.now() - hoverStart;

    console.log("[FS] hover detected", hoverTerm, ms);


    if (ms > 1200) {
      cb({
        type: "hover",
        term: hoverTerm,
        ms,
        t: Date.now()
      });
    }

    hoverStart = 0;

  });
  

}

/**
 * Backscroll detection
 */
function setupScrollSensor(cb: SensorCallback) {

  let lastY = window.scrollY;
  let backscrollCount = 0;

  window.addEventListener("scroll", () => {

    const currentY = window.scrollY;

    if (currentY < lastY) {
      backscrollCount++;
    }

    lastY = currentY;

    if (backscrollCount >= 2) {

      cb({
        type: "backscroll",
        count: backscrollCount,
        t: Date.now()
      });

      backscrollCount = 0;

    }

  });

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