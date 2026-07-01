import os
from typing import Literal, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai

# ----------------------------
# Environment
# ----------------------------
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("Missing GEMINI_API_KEY")

client = genai.Client(api_key=GEMINI_API_KEY)

MODEL_NAME = "gemini-2.5-flash"

# ----------------------------
# FastAPI
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
# Models
# ----------------------------
class TutorExplainRequest(BaseModel):
    concept: str
    interests: List[str]
    mastery: int
    masteryBand: Literal["beginner", "intermediate", "advanced"]
    pageTitle: Optional[str] = None
    contextTerms: List[str] = []
    sentenceContext: Optional[str] = None


class TutorExplainResponse(BaseModel):
    body: str


# ----------------------------
# Prompt
# ----------------------------
def build_tutor_prompt(payload: TutorExplainRequest) -> str:
    interests = ", ".join(payload.interests) if payload.interests else "none"

    return f"""
You are FrictionSync, an adaptive tutor inside a browser extension.

Concept: {payload.concept}
Mastery: {payload.masteryBand}
User interests: {interests}
Page title: {payload.pageTitle}
Context terms: {", ".join(payload.contextTerms)}
Sentence context: {payload.sentenceContext}

Explain this concept naturally.

Rules:
- 2-4 sentences.
- Beginner -> intuition first.
- Intermediate -> intuition then mechanism.
- Advanced -> concise and technical.
- Use ONE analogy only if useful.
- Do NOT use markdown.
- Do NOT use headings.
- Return ONLY the explanation.
"""


def fallback(payload: TutorExplainRequest):
    return (
        f"{payload.concept} is a concept that becomes easier to understand once "
        f"you first learn what problem it solves before studying how it works internally."
    )


# ----------------------------
# Gemini
# ----------------------------
def call_gemini(prompt: str):

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
    )

    print("========== GEMINI ==========")
    print(response)
    print("============================")

    text = response.text

    if not text:
        raise Exception("Empty Gemini response")

    return text.strip()


# ----------------------------
# Routes
# ----------------------------
@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_NAME}


@app.post("/api/tutor-explain", response_model=TutorExplainResponse)
def tutor(payload: TutorExplainRequest):

    try:
        body = call_gemini(build_tutor_prompt(payload))

        if len(body) < 20:
            raise Exception("Too short")

        return TutorExplainResponse(body=body)

    except Exception as e:
        print(e)
        return TutorExplainResponse(body=fallback(payload))