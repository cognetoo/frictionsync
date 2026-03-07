//backend call 
export type TutorAPIRequest = {
  concept: string;
  interests: string[];
  mastery: number;
  masteryBand: "beginner" | "intermediate" | "advanced";
  pageTitle?: string;
  contextTerms?: string[];
  sentenceContext?: string;
};

export type TutorAPIResponse = {
  body: string;
};

/**
 * Call backend/serverless tutor endpoint.
 * Returns null if request fails or response is invalid.
 */
export async function fetchTutorExplanation(
  apiBaseUrl: string,
  payload: TutorAPIRequest
): Promise<string | null> {
  try {
    const res = await fetch(`${apiBaseUrl}/api/tutor-explain`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.warn("[FS] tutor API returned non-OK status", res.status);
      return null;
    }

    const data = (await res.json()) as Partial<TutorAPIResponse>;

    if (!data.body || typeof data.body !== "string") {
      console.warn("[FS] tutor API response missing body");
      return null;
    }
    //avoid very short responses
    if (data.body.trim().length < 20) return null;

    return data.body.trim() || null;
  } catch (err) {
    console.warn("[FS] tutor API request failed", err);
    return null;
  }
}