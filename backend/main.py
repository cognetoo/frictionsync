import os
from typing import Literal, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai


# ----------------------------
# Environment + Gemini setup
# ----------------------------
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("Missing GEMINI_API_KEY in backend/.env")

genai.configure(api_key=GEMINI_API_KEY)

# Good fast model for this use case
MODEL_NAME = "gemini-2.0-flash"
model = genai.GenerativeModel(MODEL_NAME)


# ----------------------------
# FastAPI app
# ----------------------------
app = FastAPI(title="FrictionSync Tutor API")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------------
# Request / Response models
# ----------------------------
class TutorExplainRequest(BaseModel):
    concept: str
    interests: List[str]
    mastery: int
    masteryBand: Literal["beginner", "intermediate", "advanced"]
    pageTitle: Optional[str] = None
    contextTerms: List[str] = []


class TutorExplainResponse(BaseModel):
    body: str


# ----------------------------
# Helpers
# ----------------------------
def build_tutor_prompt(payload: TutorExplainRequest) -> str:
    interests_text = ", ".join(payload.interests) if payload.interests else "none provided"
    page_title = payload.pageTitle or "unknown"
    context_terms = ", ".join(payload.contextTerms) if payload.contextTerms else "none"

    return f"""
You are FrictionSync, an adaptive tutor inside a browser extension.

Your job is to explain ONE concept based on the user's mastery level, interests, and page context.

Concept: {payload.concept}
Mastery score: {payload.mastery}
Mastery band: {payload.masteryBand}
User interests: {interests_text}
Page title: {page_title}
Context terms: {context_terms}

Rules:
- Keep the answer to 2 to 4 sentences.
- Be specific to the concept.
- Use page title and context terms if they help make the explanation more specific.
- Do not give generic filler.
- Do not use bullet points.
- Do not use headings.
- Use plain, readable English.
- Prefer one natural analogy only if it genuinely helps.
- If the user's mastery is advanced, reduce analogy use and be more technical.
- If the user's mastery is beginner, explain with intuition first, then mechanism.
- If the user's mastery is intermediate, connect intuition to the actual mechanism.
- Avoid choosing weak or trivial comparisons.
- If user interests are useful, use the most natural one.
- Do not mention mastery score directly.
- Return only the explanation text.

Style guidance by mastery:
- beginner: intuitive, approachable, low jargon
- intermediate: mechanism-focused with some intuition
- advanced: concise, technical, high signal

Now generate the explanation.
""".strip()

def fallback_explanation(payload: TutorExplainRequest) -> str:
    concept = payload.concept.strip().lower()

    if payload.masteryBand == "beginner":
        return (
            f"{concept} is best understood first by asking what it does, what information it depends on, "
            f"and what effect it has. Start with the role it plays before trying to memorize deeper internal details."
        )

    if payload.masteryBand == "intermediate":
        return (
            f"{concept} should be understood as a mechanism, not just a definition. "
            f"Focus on what inputs it uses, what rule or process it applies, and what output or decision it produces."
        )

    return (
        f"{concept} should be analyzed in terms of its role, internal mechanism, "
        f"and downstream effect on system behavior."
    )


def call_gemini(prompt: str) -> str:
    response = model.generate_content(
        prompt,
        generation_config={
            "temperature": 0.7,
            "max_output_tokens": 220,
        },
    )

    text = getattr(response, "text", None)
    if not text or not text.strip():
        raise ValueError("Gemini returned empty text")

    return text.strip()


# ----------------------------
# Routes
# ----------------------------
@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_NAME}


@app.post("/api/tutor-explain", response_model=TutorExplainResponse)
def tutor_explain(payload: TutorExplainRequest):
    prompt = build_tutor_prompt(payload)

    try:
        print("[FrictionSync backend] tutor request:",payload.model_dump())
        print("[FrictionSync backend] build prompt: \n",prompt)
        body = call_gemini(prompt)

        # lightweight validation
        if len(body.strip()) < 20:
            raise ValueError("Generated response too short")

        return TutorExplainResponse(body=body)

    except Exception as err:
        print("[FrictionSync backend] Gemini failed, using fallback:", err)
        return TutorExplainResponse(body=fallback_explanation(payload))