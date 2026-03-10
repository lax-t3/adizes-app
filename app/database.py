from supabase import create_client, Client
from app.config import settings

# Standard client (anon key) — for auth-gated operations
supabase: Client = create_client(settings.supabase_url, settings.supabase_anon_key)

# Service role client — for admin operations (bypasses RLS)
supabase_admin: Client = create_client(
    settings.supabase_url, settings.supabase_service_role_key
)
