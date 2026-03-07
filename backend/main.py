from fastapi import FastAPI
from pydantic import BaseModel
from typing import Literal, List

app = FastAPI(title="FrictionSync Tutor API")


class TutorExplainRequest(BaseModel):
    concept: str
    interests: List[str]
    mastery: int
    masteryBand: Literal["beginner", "intermediate", "advanced"]
    pageTitle: str | None = None


class TutorExplainResponse(BaseModel):
    body: str


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/api/tutor-explain", response_model=TutorExplainResponse)
def tutor_explain(payload: TutorExplainRequest):
    concept = payload.concept.strip()
    interests = payload.interests or []
    mastery_band = payload.masteryBand

    # Temporary backend logic for now.
    # Later this will call a real LLM / model.
    if mastery_band == "beginner":
        if interests:
            body = (
                f"{concept} can be understood first through its role and purpose. "
                f"Since you like {interests[0]}, think of it like a system where decisions depend on shared information "
                f"and a clear rule for what happens next."
            )
        else:
            body = (
                f"{concept} is best understood first by asking what it does, "
                f"what information it depends on, and what effect it has."
            )

    elif mastery_band == "intermediate":
        body = (
            f"{concept} should be understood as a mechanism, not just a term. "
            f"Focus on what inputs it uses, what rule or process it applies, "
            f"and what output or decision comes from that."
        )

    else:
        body = (
            f"{concept} should be analyzed in terms of its role, internal mechanism, "
            f"and downstream effect on system behavior."
        )

    return TutorExplainResponse(body=body)