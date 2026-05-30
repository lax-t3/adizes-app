---
name: rotate-env
description: After supabase start, read the new ANON_KEY and SERVICE_ROLE_KEY from supabase status and patch them into /Users/vrln/adizes-backend/.env
---

Run:
```bash
cd /Users/vrln/adizes-backend && supabase status -o env 2>&1
```

Parse the output for these two variables:
- `ANON_KEY=<value>` → maps to `SUPABASE_ANON_KEY` in `.env`
- `SERVICE_ROLE_KEY=<value>` → maps to `SUPABASE_SERVICE_ROLE_KEY` in `.env`

Use the Edit tool to update `/Users/vrln/adizes-backend/.env`, replacing the existing values for `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` with the new ones.

**IMPORTANT:**
- Do NOT commit `.env` to git — it is in `.gitignore`
- The `SUPABASE_URL` in `.env` should remain `http://127.0.0.1:54321` (not `http://host.docker.internal:...`)
- `docker-compose.yml` overrides `SUPABASE_URL` to `host.docker.internal` for Docker — leave that file unchanged
- Keys rotate on every `supabase start` — always run this after starting Supabase
