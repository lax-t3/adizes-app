from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError

from app.config import settings
from app.routers import auth, assessment, results, admin

app = FastAPI(
    title="Adizes PAEI Assessment API",
    version="1.0.0",
    description="Backend for the Adizes Management Style Indicator platform",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(assessment.router, prefix="/assessment", tags=["assessment"])
app.include_router(results.router, prefix="/results", tags=["results"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])


@app.exception_handler(APIError)
async def postgrest_error_handler(request: Request, exc: APIError):
    """Convert PostgREST API errors to JSON — ensures CORS headers are applied."""
    msg = getattr(exc, "message", None) or str(exc)
    code = getattr(exc, "code", None)
    status = 404 if code in ("PGRST116",) else 500
    return JSONResponse(status_code=status, content={"detail": msg})


@app.exception_handler(Exception)
async def global_error_handler(request: Request, exc: Exception):
    """Catch-all: return JSON so CORS middleware can attach headers."""
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health")
def health():
    return {"status": "ok"}
