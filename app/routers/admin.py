from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from app.auth import require_admin
from app.database import supabase_admin
from app.schemas.admin import (
    CreateCohortRequest, CohortSummary, CohortDetailResponse,
    RespondentSummary, TeamScores, EnrollUserRequest, InviteAdminRequest, AdminStats,
)
from app.services.export_service import generate_cohort_csv
import uuid
import io

router = APIRouter()


def _get_auth_users_map() -> dict:
    """Fetch all auth users once and return {user_id: user_obj}."""
    try:
        users = supabase_admin.auth.admin.list_users()
        return {str(u.id): u for u in users}
    except Exception:
        return {}


@router.get("/stats", response_model=AdminStats)
def get_stats(admin: dict = Depends(require_admin)):
    cohorts_resp = supabase_admin.table("cohorts").select("id").execute()
    total_cohorts = len(cohorts_resp.data or [])

    assessments_resp = (
        supabase_admin.table("assessments")
        .select("user_id, user_name, completed_at")
        .execute()
    )
    all_assessments = assessments_resp.data or []
    total_assessments = len(all_assessments)
    completed = [a for a in all_assessments if a.get("completed_at")]
    completion_pct = round(len(completed) / total_assessments * 100) if total_assessments else 0

    recent_resp = (
        supabase_admin.table("assessments")
        .select("user_id, user_name, completed_at")
        .not_.is_("completed_at", "null")
        .order("completed_at", desc=True)
        .limit(5)
        .execute()
    )

    return AdminStats(
        total_cohorts=total_cohorts,
        total_assessments=total_assessments,
        completed_assessments=len(completed),
        completion_pct=completion_pct,
        recent_completions=recent_resp.data or [],
    )


@router.get("/cohorts", response_model=list[CohortSummary])
def list_cohorts(admin: dict = Depends(require_admin)):
    rows = (
        supabase_admin.table("cohorts")
        .select("id, name, description, created_at, cohort_members(user_id)")
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
        .select("user_id")
        .eq("cohort_id", cohort_id)
        .execute()
    )

    auth_users = _get_auth_users_map()
    respondents = []
    all_scaled = []

    for m in members_rows.data:
        uid = m["user_id"]
        auth_user = auth_users.get(uid)
        name, email = "", ""
        if auth_user:
            email = auth_user.email or ""
            meta = getattr(auth_user, "user_metadata", None) or {}
            name = meta.get("name", "")

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
            name=name,
            email=email,
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


@router.post("/cohorts/{cohort_id}/members", status_code=status.HTTP_201_CREATED)
def enroll_user(cohort_id: str, body: EnrollUserRequest, admin: dict = Depends(require_admin)):
    """Enroll an existing user into a cohort by email."""
    cohort = (
        supabase_admin.table("cohorts")
        .select("id")
        .eq("id", cohort_id)
        .single()
        .execute()
    )
    if not cohort.data:
        raise HTTPException(status_code=404, detail="Cohort not found")

    all_users = supabase_admin.auth.admin.list_users()
    target = next((u for u in all_users if u.email == body.email), None)
    if not target:
        raise HTTPException(status_code=404, detail=f"No user found with email {body.email}")

    existing = (
        supabase_admin.table("cohort_members")
        .select("user_id")
        .eq("cohort_id", cohort_id)
        .eq("user_id", str(target.id))
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="User is already a member of this cohort")

    supabase_admin.table("cohort_members").insert({
        "cohort_id": cohort_id,
        "user_id": str(target.id),
    }).execute()

    return {"message": f"{body.email} enrolled successfully", "user_id": str(target.id)}


@router.delete("/cohorts/{cohort_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(cohort_id: str, user_id: str, admin: dict = Depends(require_admin)):
    """Remove a user from a cohort."""
    supabase_admin.table("cohort_members").delete() \
        .eq("cohort_id", cohort_id).eq("user_id", user_id).execute()


@router.post("/users/invite", status_code=status.HTTP_201_CREATED)
def invite_admin(body: InviteAdminRequest, admin: dict = Depends(require_admin)):
    """Create a new admin user."""
    try:
        resp = supabase_admin.auth.admin.create_user({
            "email": body.email,
            "password": body.password,
            "email_confirm": True,
            "user_metadata": {"name": body.name},
            "app_metadata": {"role": "admin"},
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "message": f"Admin user {body.email} created successfully",
        "user_id": str(resp.user.id),
    }


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

    try:
        auth_resp = supabase_admin.auth.admin.get_user_by_id(user_id)
        auth_user = auth_resp.user
        email = auth_user.email or ""
        meta = getattr(auth_user, "user_metadata", None) or {}
        name = meta.get("name", "")
    except Exception:
        email = ""
        name = assessment.data[0].get("user_name", "")

    return {
        "user": {"id": user_id, "email": email, "name": name},
        "result": assessment.data[0],
    }


@router.get("/export/{cohort_id}")
def export_cohort_csv(cohort_id: str, admin: dict = Depends(require_admin)):
    cohort_detail = get_cohort(cohort_id, admin)
    respondents_data = [r.model_dump() for r in cohort_detail.respondents]
    csv_bytes = generate_cohort_csv(respondents_data)
    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="cohort_{cohort_id[:8]}_export.csv"'},
    )


def _compute_team_scores(all_scaled: list) -> TeamScores:
    n = len(all_scaled)
    roles = ["P", "A", "E", "I"]
    dims = ["is", "should", "want"]

    avg = {
        d: {r: round(sum(s[d][r] for s in all_scaled) / n) for r in roles}
        for d in dims
    }

    dist = {r: 0 for r in roles}
    for s in all_scaled:
        want = s.get("want", {})
        for r in roles:
            if want.get(r, 0) > 30:
                dist[r] += 1

    return TeamScores(average_scaled=avg, style_distribution=dist)
