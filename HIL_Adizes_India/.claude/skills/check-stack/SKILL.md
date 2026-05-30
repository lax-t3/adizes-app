---
name: check-stack
description: One-glance health check of all local LEAP services — Supabase, Docker backend, frontend. Prints a status table.
---

Run these checks in parallel and report results:

```bash
# 1. Supabase status
cd /Users/vrln/adizes-backend && supabase status 2>&1 | grep -E "(API URL|DB URL|Studio|Status|stopped)" | head -6

# 2. Backend health
curl -s --max-time 3 http://localhost:8000/health 2>&1 || echo "UNREACHABLE"

# 3. Frontend
curl -s --max-time 3 -o /dev/null -w "%{http_code}" http://localhost:3000 2>&1 || echo "UNREACHABLE"

# 4. Docker containers
docker ps --format "table {{.Names}}\t{{.Status}}" 2>&1 | grep -E "(NAME|adizes|supabase)" | head -10
```

Format results as a status table:

| Service | URL | Status |
|---------|-----|--------|
| Supabase Studio | http://127.0.0.1:54323 | ✓ running / ✗ stopped |
| Backend API | http://localhost:8000 | ✓ healthy / ✗ down |
| Frontend | http://localhost:3000 | ✓ 200 / ✗ not running |

If anything is down, suggest the fix:
- Supabase stopped → `/db-reset`
- Backend down → `cd /Users/vrln/adizes-backend && docker compose up --build -d`
- Frontend not running → `cd /Users/vrln/adizes-frontend && npm run dev`
