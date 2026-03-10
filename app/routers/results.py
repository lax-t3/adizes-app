from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from app.auth import get_current_user
from app.database import supabase_admin
from app.schemas.results import ResultResponse, GapDetail, Interpretation
from app.services.pdf_service import generate_pdf
import io

router = APIRouter()


def _fetch_result(result_id: str, user_id: str, is_admin: bool = False) -> dict:
    row = (
        supabase_admin.table("assessments")
        .select("*, users(name, email)")
        .eq("id", result_id)
        .single()
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Result not found")

    data = row.data
    # Non-admins can only view their own results
    if not is_admin and data["user_id"] != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return data


@router.get("/{result_id}", response_model=ResultResponse)
def get_result(result_id: str, user: dict = Depends(get_current_user)):
    is_admin = user.get("app_metadata", {}).get("role") == "admin"
    data = _fetch_result(result_id, user["sub"], is_admin)

    return ResultResponse(
        result_id=data["id"],
        user_name=data.get("users", {}).get("name", ""),
        completed_at=data["completed_at"],
        profile=data["profile"],
        scaled_scores=data["scaled_scores"],
        gaps=[GapDetail(**g) for g in data["gaps"]],
        interpretation=Interpretation(**data["interpretation"]),
    )


@router.get("/{result_id}/pdf")
def download_pdf(result_id: str, user: dict = Depends(get_current_user)):
    is_admin = user.get("app_metadata", {}).get("role") == "admin"
    data = _fetch_result(result_id, user["sub"], is_admin)

    pdf_bytes = generate_pdf(data)

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="PAEI_Report_{result_id[:8]}.pdf"'
        },
    )
