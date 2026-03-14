from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
import boto3
import json
import logging
from app.auth import get_current_user
from app.database import supabase_admin
from app.schemas.assessment import QuestionsResponse, SubmitRequest, SubmitResponse, Section, Question, Option
from app.services.scoring import score_answers
from app.services.gap_analysis import compute_gaps
from app.services.interpretation import interpret
from app.config import settings
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

router = APIRouter()


def _build_pdf_payload(result_id: str, user_name: str, now: str,
                        scores: dict, gaps: list, interp: dict) -> dict:
    """Build the JSON payload for the PDF Lambda function."""
    return {
        "assessment_id": result_id,
        "user_name": user_name,
        "completed_at": now,
        "profile": scores["profile"],
        "scaled_scores": scores["scaled"],
        "gaps": gaps,
        "interpretation": interp,
    }


def _trigger_pdf_lambda(assessment_id: str, payload: dict) -> None:
    """Fire-and-forget: invoke Lambda async. Non-fatal if it fails."""
    if not settings.aws_access_key_id:
        logger.info(f"[pdf-lambda] AWS credentials not configured — skipping trigger for {assessment_id}")
        return
    try:
        client = boto3.client(
            "lambda",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )
        client.invoke(
            FunctionName=settings.pdf_lambda_function_name,
            InvocationType="Event",
            Payload=json.dumps(payload).encode(),
        )
        logger.info(f"[pdf-lambda] Triggered async PDF generation for assessment {assessment_id}")
    except Exception as e:
        logger.error(f"[pdf-lambda] Trigger failed for assessment {assessment_id}: {e}")


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
def submit_assessment(body: SubmitRequest, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    """Score a completed assessment and persist the result."""
    if len(body.answers) != 36:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Expected 36 answers, got {len(body.answers)}",
        )

    user_id = user["sub"]
    user_name = (user.get("user_metadata") or {}).get("name", "")

    # Verify user is enrolled in the specified cohort
    cohort_id = body.cohort_id
    enrollment = (
        supabase_admin.table("cohort_members")
        .select("user_id")
        .eq("cohort_id", cohort_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not enrollment.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not enrolled in this cohort",
        )

    answers_dicts = [a.model_dump() for a in body.answers]

    # Score
    scores = score_answers(answers_dicts)
    gaps = compute_gaps(scores["scaled"])
    interp = interpret(scores["scaled"], scores["profile"])

    result_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    # Persist assessment
    supabase_admin.table("assessments").insert({
        "id": result_id,
        "user_id": user_id,
        "user_name": user_name,
        "cohort_id": cohort_id,
        "completed_at": now,
        "raw_scores": scores["raw"],
        "scaled_scores": scores["scaled"],
        "profile": scores["profile"],
        "gaps": [g for g in gaps],
        "interpretation": interp,
        "status": "completed",
    }).execute()

    # Persist individual answers
    answer_rows = [
        {
            "assessment_id": result_id,
            "question_index": a["question_index"],
            "option_key": next(k for k, v in a["ranks"].items() if v == 1),
            "ranks": a["ranks"],
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
            cohort_name_for_email = ""
            try:
                cohort_name_row = (
                    supabase_admin.table("cohorts")
                    .select("name")
                    .eq("id", cohort_id)
                    .single()
                    .execute()
                )
                if cohort_name_row.data:
                    cohort_name_for_email = cohort_name_row.data.get("name", "")
            except Exception:
                pass

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

            # Generate PDF — failure is non-fatal, email still sends without attachment
            pdf_attachment = None
            try:
                pdf_bytes = generate_pdf(assessment_data)
                pdf_attachment = [{
                    "filename": f"PAEI_Report_{result_id[:8]}.pdf",
                    "data": pdf_bytes,
                }]
            except Exception as pdf_err:
                logger.error(f"[assessment] PDF generation failed for {result_id}: {pdf_err}")

            send_template_email("assessment_complete", user_email, {
                "user_name": user_name or user_email,
                "user_email": user_email,
                "cohort_name": cohort_name_for_email or "your cohort",
                "dominant_style": dominant,
                "platform_name": "Adizes India",
                "platform_url": settings.frontend_url,
            }, attachments=pdf_attachment or [])
    except Exception as e:
        logger.error(f"[assessment] Completion email failed (non-fatal): {e}")

    # Trigger async PDF generation in Lambda (non-blocking)
    pdf_payload = _build_pdf_payload(result_id, user_name, now, scores, gaps, interp)
    background_tasks.add_task(_trigger_pdf_lambda, result_id, pdf_payload)

    return SubmitResponse(result_id=result_id)
