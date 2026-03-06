import {
  getProfile,
  setProfile,
  getTopMastery,
  resetMastery,
  type UserProfile
} from "../background/store/profileStore";

/**
 * Small helper to safely get DOM elements with types.
 */
function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing element: ${id}`);
  }
  return el as T;
}

const enabledToggle = $<HTMLInputElement>("enabledToggle");
const interestsInput = $<HTMLInputElement>("interestsInput");
const saveInterestsBtn = $<HTMLButtonElement>("saveInterestsBtn");
const masteryList = $<HTMLDivElement>("masteryList");
const openOptionsBtn = $<HTMLButtonElement>("openOptionsBtn");
const resetMasteryBtn = $<HTMLButtonElement>("resetMasteryBtn");

/**
 * Load profile + mastery into popup UI.
 */
async function initPopup() {
  const profile = await getProfile();

  enabledToggle.checked = profile.enabled;
  interestsInput.value = profile.interests.join(", ");

  await renderMastery();
}

/**
 * Render top mastery pills into the popup.
 */
async function renderMastery() {
  const items = await getTopMastery(6);

  masteryList.innerHTML = "";

  if (items.length === 0) {
    masteryList.innerHTML = `<div class="muted">No mastery data yet.</div>`;
    return;
  }

  for (const [concept, score] of items) {
    const row = document.createElement("div");
    row.className = "pill";
    row.textContent = `${concept} — ${score}`;
    masteryList.appendChild(row);
  }
}

/**
 * Parse comma-separated interests from input.
 */
function parseInterests(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}

/**
 * Save only the interests field, keeping the rest of profile unchanged.
 */
async function saveInterests() {
  const profile = await getProfile();
  const next: UserProfile = {
    ...profile,
    interests: parseInterests(interestsInput.value)
  };
  interestsInput.value = next.interests.join(", ");

  await setProfile(next);
}

/**
 * Toggle enabled/disabled state.
 */
async function setEnabled(enabled: boolean) {
  const profile = await getProfile();
  await setProfile({
    ...profile,
    enabled
  });
}

/**
 * Wire all popup events.
 */
function bindEvents() {
  enabledToggle.addEventListener("change", async () => {
    await setEnabled(enabledToggle.checked);
  });

  saveInterestsBtn.addEventListener("click", async () => {
    await saveInterests();
    saveInterestsBtn.textContent = "Saved!";
    window.setTimeout(() => {
      saveInterestsBtn.textContent = "Save interests";
    }, 1000);
  });

  resetMasteryBtn.addEventListener("click", async () => {
    await resetMastery();
    await renderMastery();
  });

  openOptionsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

initPopup();
bindEvents();