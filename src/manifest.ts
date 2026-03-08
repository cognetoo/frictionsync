import type { ManifestV3Export } from "@crxjs/vite-plugin";

const manifest: ManifestV3Export = {
  manifest_version: 3,
  name: "FrictionSync",
  version: "0.1.0",
  description:
 "Detects learning friction while browsing and provides short AI explanations based on the page context.",
  permissions: ["storage", "tabs"],
  host_permissions: ["<all_urls>","https://frictionsync.onrender.com/*"],
  background: {
    service_worker: "src/background/background.ts",
    type: "module"
  },
  action: {
    default_popup: "src/popup/popup.html",
    default_title: "FrictionSync"
  },
  options_page: "src/options/options.html",
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/content.ts"],
      run_at: "document_idle"
    }
  ],
  icons: {
    "16": "icon16.png",
    "48": "icon48.png",
    "128": "icon128.png"
  }
};

export default manifest;