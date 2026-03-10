from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from app.auth import require_admin
from app.database import supabase_admin
from app.schemas.admin import (
    CreateCohortRequest, CohortSummary, CohortDetailResponse,
    RespondentSummary, TeamScores,
)
from app.services.export_service import generate_cohort_csv
import uuid
import io

router = APIRouter()


@router.get("/cohorts", response_model=list[CohortSummary])
def list_cohorts(admin: dict = Depends(require_admin)):
    rows = (
        supabase_admin.table("cohorts")
        .select("id, name, description, created_at, cohort_members(user_id, users(id))")
        .order("created_at", desc=True)
        .execute()
    )

    results = []
    for c in rows.data:
        members = c.get("cohort_members", [])
        member_ids = [m["user_id"] for m in members]
        completed = 0
        if member_ids:
            comp_rows = (
                supabase_admin.table("assessments")
                .select("user_id")
                .in_("user_id", member_ids)
                .not_.is_("completed_at", "null")
                .execute()
            )
            completed = len(comp_rows.data)

        total = len(members)
        results.append(CohortSummary(
            id=c["id"],
            name=c["name"],
            description=c.get("description"),
            member_count=total,
            completed_count=completed,
            completion_pct=round(completed / total * 100, 1) if total else 0.0,
            created_at=c["created_at"],
        ))

    return results


@router.post("/cohorts", response_model=CohortSummary, status_code=status.HTTP_201_CREATED)
def create_cohort(body: CreateCohortRequest, admin: dict = Depends(require_admin)):
    row = supabase_admin.table("cohorts").insert({
        "id": str(uuid.uuid4()),
        "name": body.name,
        "description": body.description,
        "admin_id": admin["sub"],
    }).execute()

    c = row.data[0]
    return CohortSummary(
        id=c["id"],
        name=c["name"],
        description=c.get("description"),
        member_count=0,
        completed_count=0,
        completion_pct=0.0,
        created_at=c["created_at"],
    )


@router.get("/cohorts/{cohort_id}", response_model=CohortDetailResponse)
def get_cohort(cohort_id: str, admin: dict = Depends(require_admin)):
    cohort = (
        supabase_admin.table("cohorts")
        .select("id, name, description")
        .eq("id", cohort_id)
        .single()
        .execute()
    )
    if not cohort.data:
        raise HTTPException(status_code=404, detail="Cohort not found")

    members_rows = (
        supabase_admin.table("cohort_members")
        .select("user_id, users(id, email, raw_user_meta_data)")
        .eq("cohort_id", cohort_id)
        .execute()
    )

    respondents = []
    all_scaled = []

    for m in members_rows.data:
        user_info = m.get("users", {})
        uid = m["user_id"]
        meta = user_info.get("raw_user_meta_data", {}) or {}

        # Get latest assessment
        assessment = (
            supabase_admin.table("assessments")
            .select("id, completed_at, scaled_scores, interpretation")
            .eq("user_id", uid)
            .order("completed_at", desc=True)
            .limit(1)
            .execute()
        )

        a = assessment.data[0] if assessment.data else None
        dominant = None
        if a and a.get("interpretation"):
            dominant = "".join(a["interpretation"].get("dominant_roles", []))
        if a and a.get("scaled_scores"):
            all_scaled.append(a["scaled_scores"])

        respondents.append(RespondentSummary(
            user_id=uid,
            name=meta.get("name", ""),
            email=user_info.get("email", ""),
            status="completed" if (a and a.get("completed_at")) else "pending",
            dominant_style=dominant,
            completed_at=a["completed_at"] if a else None,
        ))

    team_scores = _compute_team_scores(all_scaled) if all_scaled else None

    return CohortDetailResponse(
        id=cohort.data["id"],
        name=cohort.data["name"],
        description=cohort.data.get("description"),
        respondents=respondents,
        team_scores=team_scores,
    )


@router.get("/respondents/{user_id}")
def get_respondent(user_id: str, admin: dict = Depends(require_admin)):
    assessment = (
        supabase_admin.table("assessments")
        .select("*")
        .eq("user_id", user_id)
        .order("completed_at", desc=True)
        .limit(1)
        .execute()
    )
    if not assessment.data:
        raise HTTPException(status_code=404, detail="No completed assessment found")

    user_row = (
        supabase_admin.table("users")
        .select("email, raw_user_meta_data")
        .eq("id", user_id)
        .single()
        .execute()
    )

    return {
        "user": {
            "id": user_id,
            "email": user_row.data.get("email", "") if user_row.data else "",
            "name": (user_row.data or {}).get("raw_user_meta_data", {}).get("name", ""),
        },
        "result": assessment.data[0],
    }


@router.get("/export/{cohort_id}")
def export_cohort_csv(cohort_id: str, admin: dict = Depends(require_admin)):
    """Download all respondents' results as CSV."""
    cohort_detail = get_cohort(cohort_id, admin)
    respondents_data = [r.model_dump() for r in cohort_detail.respondents]

    csv_bytes = generate_cohort_csv(respondents_data)

    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="cohort_{cohort_id[:8]}_export.csv"'
        },
    )


def _compute_team_scores(all_scaled: list) -> TeamScores:
    """Average scaled scores across all completed assessments."""
    n = len(all_scaled)
    roles = ["P", "A", "E", "I"]
    dims = ["is", "should", "want"]

    avg = {
        d: {r: round(sum(s[d][r] for s in all_scaled) / n) for r in roles}
        for d in dims
    }

    # Style distribution: count dominant roles from Want dimension
    dist = {r: 0 for r in roles}
    for s in all_scaled:
        want = s.get("want", {})
        for r in roles:
            if want.get(r, 0) > 30:
                dist[r] += 1

    return TeamScores(average_scaled=avg, style_distribution=dist)
