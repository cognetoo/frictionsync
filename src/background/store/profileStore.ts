export type UserProfile = {
  enabled: boolean;
  interests: string[];
  mastery: Record<string, number>; // concept -> score
  // later: preferred_style, difficulty, etc.
};

const DEFAULT_PROFILE: UserProfile = {
  enabled: true,
  interests: ["Clash Royale"],
  mastery: {}
};

const KEY = "frx_profile";

/**
 * Get the user profile from chrome.storage.local.
 * If it doesn't exist, return DEFAULT_PROFILE.
 */
export async function getProfile(): Promise<UserProfile> {
  const res = await chrome.storage.local.get([KEY]);
  const p = res[KEY] as UserProfile | undefined;

  if (!p || typeof p !== "object") return structuredClone(DEFAULT_PROFILE);

  return {
    enabled: typeof p.enabled === "boolean" ? p.enabled : DEFAULT_PROFILE.enabled,
    interests: Array.isArray(p.interests) ? p.interests.filter(Boolean) : DEFAULT_PROFILE.interests,
    mastery: p.mastery && typeof p.mastery === "object" ? p.mastery : {}
  };
}

/**
 * Overwrite profile in storage.
 */
export async function setProfile(profile: UserProfile): Promise<void> {
  await chrome.storage.local.set({ [KEY]: profile });
}

/**
 * Update profile with a function 
 */
export async function updateProfile(
  fn: (current: UserProfile) => UserProfile
): Promise<UserProfile> {
  const cur = await getProfile();
  const next = fn(cur);
  await setProfile(next);
  return next;
}


export async function bumpMastery(concept: string, delta: number): Promise<UserProfile> {

    const key = concept.trim().toLowerCase();
    if (!key) return getProfile();


  return updateProfile((p) => {
    const cur = p.mastery[key] ?? 0;
    const nextScore = Math.max(0, cur + delta);
    return { ...p, mastery: { ...p.mastery, [key]: nextScore } };
  });
}

/**
 * Get top mastered concepts for UI display.
 */
export async function getTopMastery(limit = 8): Promise<Array<[string, number]>> {
  const p = await getProfile();
  return Object.entries(p.mastery)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

/**
 * Clear mastery data only
 */
export async function resetMastery(): Promise<UserProfile> {
  return updateProfile((p) => ({ ...p, mastery: {} }));
}