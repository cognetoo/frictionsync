type BubblePayload = {
  title: string;
  body: string;
  cta: string;
  concept: string;
  styleTag: string;
};

type BubbleCallbacks = {
  onGotIt: () => void;
  onDismiss: () => void;
};

let rootHost: HTMLDivElement | null = null;
let removeEscListener: (() => void) | null = null;
let activeContainer: HTMLDivElement | null = null;
let isClosing = false;

/**
 * Show a floating bubble on the page with Shadow DOM isolation.
 */
export function showBubble(payload: BubblePayload, cb: BubbleCallbacks) {
  cleanup(true);

  rootHost = document.createElement("div");
  rootHost.id = "fs-root-host";
  rootHost.style.position = "fixed";
  rootHost.style.right = "20px";
  rootHost.style.bottom = "20px";
  rootHost.style.zIndex = "2147483647";
  rootHost.style.pointerEvents = "auto";
  rootHost.style.display = "block";

  const shadow = rootHost.attachShadow({ mode: "open" });

  const container = document.createElement("div");
  container.className = "fs-card";
  activeContainer = container;

  container.innerHTML = `
    <div class="fs-glow"></div>

    <div class="fs-header">
      <div class="fs-badge">FrictionSync</div>
      <button class="fs-x" title="Dismiss" aria-label="Dismiss">✕</button>
    </div>

    <div class="fs-main">
      <div class="fs-title">${escapeHtml(payload.title)}</div>
      <div class="fs-body">${formatBody(payload.body)}</div>
    </div>

    <div class="fs-footer">
      <button class="fs-btn fs-secondary" type="button">Dismiss</button>
      <button class="fs-btn fs-primary" type="button">${escapeHtml(payload.cta)}</button>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = getCss();

  shadow.appendChild(style);
  shadow.appendChild(container);
  document.documentElement.appendChild(rootHost);

  const xBtn = shadow.querySelector(".fs-x") as HTMLButtonElement | null;
  const dismissBtn = shadow.querySelector(".fs-secondary") as HTMLButtonElement | null;
  const gotBtn = shadow.querySelector(".fs-primary") as HTMLButtonElement | null;

  const dismiss = () => {
    cb.onDismiss();
    closeBubble();
  };

  const gotIt = () => {
    cb.onGotIt();
    closeBubble();
  };

  xBtn?.addEventListener("click", dismiss);
  dismissBtn?.addEventListener("click", dismiss);
  gotBtn?.addEventListener("click", gotIt);

  attachEscapeToClose(cb);

  requestAnimationFrame(() => {
    container.classList.add("fs-show");
  });
}

function closeBubble() {
  if (!activeContainer || isClosing) return;
  isClosing = true;

  activeContainer.classList.remove("fs-show");
  activeContainer.classList.add("fs-hide");

  window.setTimeout(() => {
    cleanup(true);
  }, 220);
}

/**
 * Remove bubble if it exists.
 */
export function cleanup(skipAnimation = false) {
  if (removeEscListener) {
    removeEscListener();
    removeEscListener = null;
  }

  if (!rootHost) {
    activeContainer = null;
    isClosing = false;
    return;
  }

  if (!skipAnimation && activeContainer && !isClosing) {
    closeBubble();
    return;
  }

  rootHost.remove();
  rootHost = null;
  activeContainer = null;
  isClosing = false;
}

function formatBody(text: string): string {
  const safe = escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
  return safe;
}

/**
 * Escape HTML to prevent injection.
 */
function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getCss(): string {
  return `
    :host {
      all: initial;
    }

    .fs-card {
      position: relative;
      overflow: hidden;
      width: 372px;
      max-width: min(372px, calc(100vw - 24px));
      box-sizing: border-box;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(248,250,252,0.97) 100%);
      color: #0f172a;
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 20px;
      box-shadow:
        0 20px 50px rgba(2, 6, 23, 0.18),
        0 8px 20px rgba(2, 6, 23, 0.10);
      padding: 14px;
      backdrop-filter: blur(14px);
      transform: translateY(18px) scale(0.98);
      opacity: 0;
      transition:
        transform 180ms ease,
        opacity 180ms ease,
        box-shadow 180ms ease;
    }

    .fs-card.fs-show {
      transform: translateY(0) scale(1);
      opacity: 1;
    }

    .fs-card.fs-hide {
      transform: translateY(12px) scale(0.985);
      opacity: 0;
    }

    .fs-card:hover {
      box-shadow:
        0 24px 56px rgba(2, 6, 23, 0.20),
        0 10px 24px rgba(2, 6, 23, 0.12);
    }

    .fs-glow {
      position: absolute;
      inset: -40% auto auto -20%;
      width: 180px;
      height: 180px;
      background: radial-gradient(circle, rgba(56,189,248,0.18), rgba(56,189,248,0));
      pointer-events: none;
    }

    .fs-header {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 10px;
    }

    .fs-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(14, 165, 233, 0.10);
      color: #0369a1;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    .fs-x {
      all: unset;
      box-sizing: border-box;
      cursor: pointer;
      width: 32px;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      color: rgba(15, 23, 42, 0.65);
      transition: background 140ms ease, color 140ms ease, transform 140ms ease;
    }

    .fs-x:hover {
      background: rgba(15, 23, 42, 0.06);
      color: rgba(15, 23, 42, 0.92);
      transform: scale(1.03);
    }

    .fs-main {
      position: relative;
      z-index: 1;
      margin-bottom: 14px;
    }

    .fs-title {
      font-size: 17px;
      font-weight: 750;
      line-height: 1.28;
      letter-spacing: -0.01em;
      color: #020617;
      margin-bottom: 8px;
    }

    .fs-body {
      font-size: 14px;
      line-height: 1.62;
      color: #334155;
    }

    .fs-body strong {
      color: #0f172a;
      font-weight: 750;
    }

    .fs-footer {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
    }

    .fs-btn {
      all: unset;
      box-sizing: border-box;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 88px;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 700;
      transition:
        transform 140ms ease,
        background 140ms ease,
        box-shadow 140ms ease,
        border-color 140ms ease;
    }

    .fs-btn:hover {
      transform: translateY(-1px);
    }

    .fs-btn:active {
      transform: translateY(0);
    }

    .fs-secondary {
      background: rgba(15, 23, 42, 0.05);
      color: #334155;
      border: 1px solid rgba(15, 23, 42, 0.08);
    }

    .fs-secondary:hover {
      background: rgba(15, 23, 42, 0.08);
    }

    .fs-primary {
      background: linear-gradient(180deg, #22c55e 0%, #16a34a 100%);
      color: white;
      box-shadow: 0 8px 18px rgba(34, 197, 94, 0.28);
    }

    .fs-primary:hover {
      box-shadow: 0 10px 22px rgba(34, 197, 94, 0.34);
      filter: brightness(1.01);
    }

    @media (max-width: 480px) {
      .fs-card {
        width: min(372px, calc(100vw - 16px));
        border-radius: 18px;
        padding: 13px;
      }

      .fs-title {
        font-size: 16px;
      }

      .fs-body {
        font-size: 13px;
      }
    }
  `;
}

function attachEscapeToClose(cb: BubbleCallbacks) {
  const handler = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    cb.onDismiss();
    closeBubble();
  };

  document.addEventListener("keydown", handler);
  removeEscListener = () => document.removeEventListener("keydown", handler);
}