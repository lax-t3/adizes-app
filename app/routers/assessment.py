from fastapi import APIRouter, Depends, HTTPException, status
from app.auth import get_current_user
from app.database import supabase_admin
from app.schemas.assessment import QuestionsResponse, SubmitRequest, SubmitResponse, Section, Question, Option
from app.services.scoring import score_answers
from app.services.gap_analysis import compute_gaps
from app.services.interpretation import interpret
from app.config import settings
import uuid
from datetime import datetime, timezone

router = APIRouter()

SECTION_META = [
    {
        "name": "is",
        "label": "Is",
        "description": (
            "Answer each question based on how you currently operate "
            "in your role — the 'here and now' of your management style."
        ),
    },
    {
        "name": "should",
        "label": "Should",
        "description": (
            "Answer each question based on what you believe your job "
            "and organisation requires of you."
        ),
    },
    {
        "name": "want",
        "label": "Want",
        "description": (
            "Answer each question based on what you genuinely prefer — "
            "your core, inner management style."
        ),
    },
]


@router.get("/questions", response_model=QuestionsResponse)
def get_questions(_: dict = Depends(get_current_user)):
    """Return all 36 questions grouped into 3 sections."""
    rows = (
        supabase_admin.table("questions")
        .select("id, question_index, text, options(id, option_key, text, paei_role)")
        .order("question_index")
        .execute()
    )

    # Group into sections of 12
    sections = []
    for i, meta in enumerate(SECTION_META):
        start = i * 12
        end = start + 12
        section_qs = rows.data[start:end]
        questions = [
            Question(
                id=q["id"],
                question_index=q["question_index"],
                text=q["text"],
                options=[
                    Option(
                        key=o["option_key"],
                        text=o["text"],
                        paei_role=o["paei_role"],
                    )
                    for o in sorted(q["options"], key=lambda x: x["option_key"])
                ],
            )
            for q in section_qs
        ]
        sections.append(Section(
            name=meta["name"],
            label=meta["label"],
            description=meta["description"],
            questions=questions,
        ))

    return QuestionsResponse(sections=sections)


@router.post("/submit", response_model=SubmitResponse)
def submit_assessment(body: SubmitRequest, user: dict = Depends(get_current_user)):
    """Score a completed assessment and persist the result."""
    if len(body.answers) != 36:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Expected 36 answers, got {len(body.answers)}",
        )

    answers_dicts = [a.model_dump() for a in body.answers]

    # Score
    scores = score_answers(answers_dicts)
    gaps = compute_gaps(scores["scaled"])
    interp = interpret(scores["scaled"], scores["profile"])

    result_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    user_id = user["sub"]

    user_name = (user.get("user_metadata") or {}).get("name", "")

    # Persist assessment
    supabase_admin.table("assessments").insert({
        "id": result_id,
        "user_id": user_id,
        "user_name": user_name,
        "completed_at": now,
        "raw_scores": scores["raw"],
        "scaled_scores": scores["scaled"],
        "profile": scores["profile"],
        "gaps": [g for g in gaps],
        "interpretation": interp,
    }).execute()

    # Persist individual answers
    answer_rows = [
        {
            "assessment_id": result_id,
            "question_index": a["question_index"],
            "option_key": a["option_key"],
        }
        for a in answers_dicts
    ]
    supabase_admin.table("answers").insert(answer_rows).execute()

    # Send completion email with PDF attachment (non-fatal if it fails)
    try:
        from app.services.email_service import send_template_email, smtp_configured
        from app.services.pdf_service import generate_pdf
        if smtp_configured():
            user_email = (user.get("email") or
                          (supabase_admin.auth.admin.get_user_by_id(user_id).user.email) or "")
            # Find cohort for this user
            cohort_row = (
                supabase_admin.table("cohort_members")
                .select("cohort_id, cohorts(name)")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            cohort_name_for_email = ""
            if cohort_row.data:
                c = cohort_row.data[0].get("cohorts")
                cohort_name_for_email = c.get("name", "") if c else ""

            dominant = "".join(interp.get("dominant_roles", []))

            # Build assessment data dict for PDF
            assessment_data = {
                "id": result_id,
                "user_id": user_id,
                "user_name": user_name,
                "completed_at": now,
                "raw_scores": scores["raw"],
                "scaled_scores": scores["scaled"],
                "profile": scores["profile"],
                "gaps": [g for g in gaps],
                "interpretation": interp,
            }
            pdf_bytes = generate_pdf(assessment_data)

            send_template_email("assessment_complete", user_email, {
                "user_name": user_name or user_email,
                "user_email": user_email,
                "cohort_name": cohort_name_for_email or "your cohort",
                "dominant_style": dominant,
                "platform_name": "Adizes PAEI Platform",
                "platform_url": settings.frontend_url,
            }, attachments=[{
                "filename": f"PAEI_Report_{result_id[:8]}.pdf",
                "data": pdf_bytes,
            }])
    except Exception as e:
        print(f"[assessment] Completion email failed (non-fatal): {e}")

    return SubmitResponse(result_id=result_id)
