import {
  getProfile,
  setProfile,
  getTopMastery,
  resetMastery,
  type UserProfile
} from "../background/store/profileStore";

/**
 * Small helper to safely fetch DOM elements with type support.
 */
function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing element: ${id}`);
  }
  return el as T;
}

const enabledToggle = $<HTMLInputElement>("enabledToggle");
const ghostOverlayToggle = $<HTMLInputElement>("ghostOverlayToggle");
const interestsInput = $<HTMLInputElement>("interestsInput");
const saveInterestsBtn = $<HTMLButtonElement>("saveInterestsBtn");
const masteryList = $<HTMLDivElement>("masteryList");
const resetMasteryBtn = $<HTMLButtonElement>("resetMasteryBtn");

/**
 * Load current profile into the options page UI.
 */
async function initOptionsPage() {
  const profile = await getProfile();

  enabledToggle.checked = profile.enabled;
  ghostOverlayToggle.checked = profile.ghostOverlayEnabled;
  interestsInput.value = profile.interests.join(", ");

  await renderMastery();
}

/**
 * Render mastery items as pills.
 */
async function renderMastery() {
  const items = await getTopMastery(20);

  masteryList.innerHTML = "";

  if (items.length === 0) {
    masteryList.innerHTML = `<div class="muted">No mastery data yet.</div>`;
    return;
  }

  for (const [concept, score] of items) {
    const pill = document.createElement("div");
    pill.className = "pill";
    pill.textContent = `${concept} — ${score}`;
    masteryList.appendChild(pill);
  }
}

/**
 * Parse comma-separated interests into a cleaned array.
 */
function parseInterests(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
}

/**
 * Save interests while preserving all other profile fields.
 */
async function saveInterests() {
  const profile = await getProfile();

  const next: UserProfile = {
    ...profile,
    interests: parseInterests(interestsInput.value)
  };

  await setProfile(next);

  // normalize field display after saving
  interestsInput.value = next.interests.join(", ");
}

/**
 * Save one or more settings while preserving the rest of profile.
 */
async function patchProfile(partial: Partial<UserProfile>) {
  const profile = await getProfile();

  await setProfile({
    ...profile,
    ...partial
  });
}

/**
 * Wire UI interactions.
 */
function bindEvents() {
  enabledToggle.addEventListener("change", async () => {
    await patchProfile({
      enabled: enabledToggle.checked
    });
  });

  ghostOverlayToggle.addEventListener("change", async () => {
    await patchProfile({
      ghostOverlayEnabled: ghostOverlayToggle.checked
    });
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

    resetMasteryBtn.textContent = "Mastery reset!"

        window.setTimeout(() => {
      resetMasteryBtn.textContent = "Reset mastery";
    }, 1000);
  });
}

initOptionsPage();
bindEvents();