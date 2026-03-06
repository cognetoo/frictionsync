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

/**
 * Show a floating bubble on the page with Shadow DOM isolation.
 */
export function showBubble(payload: BubblePayload, cb: BubbleCallbacks) {
  // If already shown, remove old one first
  cleanup();

  rootHost = document.createElement("div");
  rootHost.id = "fs-root-host";
  rootHost.style.position = "fixed";
  rootHost.style.right = "16px";
  rootHost.style.bottom = "16px";
  rootHost.style.zIndex = "2147483647"; // above everything
  rootHost.style.pointerEvents = "auto";
  rootHost.style.display = "block";

// TEMP DEBUG 
rootHost.style.outline = "2px solid red";

  const shadow = rootHost.attachShadow({ mode: "open" });

  const container = document.createElement("div");
  container.className = "fs-card";

  container.innerHTML = `
    <div class="fs-header">
      <div class="fs-title">${escapeHtml(payload.title)}</div>
      <button class="fs-x" title="Dismiss">✕</button>
    </div>

    <div class="fs-body">
      ${formatBody(payload.body)}
    </div>

    <div class="fs-footer">
      <button class="fs-btn fs-gotit">${escapeHtml(payload.cta)}</button>
      <div class="fs-meta">${escapeHtml(payload.styleTag)}</div>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = getCss();

  shadow.appendChild(style);
  shadow.appendChild(container);

  document.documentElement.appendChild(rootHost);

  // Wire actions
  const xBtn = shadow.querySelector(".fs-x") as HTMLButtonElement | null;
  const gotBtn = shadow.querySelector(".fs-gotit") as HTMLButtonElement | null;

  xBtn?.addEventListener("click", () => {
    cb.onDismiss();
    cleanup();
  });

  gotBtn?.addEventListener("click", () => {
    cb.onGotIt();
    cleanup();
  });

 
  attachEscapeToClose(cb);
}

/**
 * Remove bubble if it exists.
 */
export function cleanup() {
  if (removeEscListener) {
    removeEscListener();
    removeEscListener = null;
  }
  if (rootHost) {
    rootHost.remove();
    rootHost = null;
  }
}


function formatBody(text: string): string {
  // escape first
  const safe = escapeHtml(text);

  // very tiny markdown: **bold**
  return safe.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
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
    .fs-card{
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      width: 340px;
      background: #111827;
      color: #F9FAFB;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 14px;
      box-shadow: 0 12px 30px rgba(0,0,0,0.35);
      padding: 12px;
    }

    .fs-header{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 8px;
      margin-bottom: 8px;
    }

    .fs-title{
      font-size: 14px;
      font-weight: 700;
      line-height: 1.2;
    }

    .fs-x{
      all: unset;
      cursor: pointer;
      width: 28px;
      height: 28px;
      display:flex;
      align-items:center;
      justify-content:center;
      border-radius: 8px;
      color: rgba(255,255,255,0.8);
    }
    .fs-x:hover{
      background: rgba(255,255,255,0.10);
    }

    .fs-body{
      font-size: 13px;
      line-height: 1.45;
      color: rgba(255,255,255,0.92);
      margin-bottom: 10px;
      white-space: pre-wrap;
    }

    .fs-footer{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 10px;
    }

    .fs-btn{
      all: unset;
      cursor: pointer;
      padding: 8px 10px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 700;
      background: #22C55E;
      color: #052e16;
    }
    .fs-btn:hover{
      filter: brightness(0.95);
    }

    .fs-meta{
      font-size: 11px;
      opacity: 0.65;
    }
  `;
}


function attachEscapeToClose(cb: BubbleCallbacks) {
  const handler = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    cb.onDismiss();
    cleanup();
  };

  document.addEventListener("keydown", handler);
  removeEscListener = () => document.removeEventListener("keydown", handler);
}