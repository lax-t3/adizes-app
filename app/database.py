from typing import List
from supabase import create_client, Client
from app.config import settings

# Standard client (anon key) — for auth-gated operations
supabase: Client = create_client(settings.supabase_url, settings.supabase_anon_key)

# Service role client — for admin operations (bypasses RLS)
supabase_admin: Client = create_client(
    settings.supabase_url, settings.supabase_service_role_key
)


def list_all_auth_users(per_page: int = 200) -> List:
    """Return ALL auth users, paginating past the GoTrue page limit.

    `supabase_admin.auth.admin.list_users()` only returns the FIRST page
    (default ~50). Any flow that searches for a user by email via a single
    `list_users()` call silently misses everyone beyond page 1 — breaking
    forgot-password, enrolment, and admin-user listing once the project grows
    past one page. This helper loops pages until an empty page is returned,
    which is correct regardless of the server-side per_page cap.
    """
    users: list = []
    page = 1
    while True:
        batch = supabase_admin.auth.admin.list_users(page=page, per_page=per_page)
        if not batch:
            break
        users.extend(batch)
        page += 1
        if page > 500:  # safety valve (~100k users) — never loop unbounded
            break
    return users
