---
name: seed-local
description: Recreate the two local test users (admin + regular) after a Supabase restart wipes auth.users. Requires Supabase to be running and .env to have current SERVICE_ROLE_KEY.
---

Read the current `SUPABASE_SERVICE_ROLE_KEY` from `/Users/vrln/adizes-backend/.env`, then run:

```bash
cd /Users/vrln/adizes-backend
SK=$(grep SUPABASE_SERVICE_ROLE_KEY .env | cut -d= -f2-)

# Create admin user
curl -s -X POST "http://127.0.0.1:54321/auth/v1/admin/users" \
  -H "apikey: $SK" \
  -H "Authorization: Bearer $SK" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@adizes.com","password":"Admin@1234","email_confirm":true,"app_metadata":{"role":"admin"}}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('admin:', d.get('email','ERROR'), d.get('id','')[:8])"

# Create regular user
curl -s -X POST "http://127.0.0.1:54321/auth/v1/admin/users" \
  -H "apikey: $SK" \
  -H "Authorization: Bearer $SK" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@adizes.com","password":"User@1234","email_confirm":true}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('user:', d.get('email','ERROR'), d.get('id','')[:8])"
```

If you see `ERROR` in output, check that Supabase is running (`supabase status`) and that the SK key is correct (run `/rotate-env` if needed).

Test credentials:
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@adizes.com | Admin@1234 |
| User | user@adizes.com | User@1234 |
