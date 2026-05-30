---
name: new-router
description: Scaffold a new FastAPI router for adizes-backend — creates the router file with standard structure and wires it into main.py. Usage: /new-router <name>
---

The user will provide a router name (e.g. `reports`).

## Step 1: Create the router file
Create `/Users/vrln/adizes-backend/app/routers/<name>.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, status
from ..auth import get_current_user
from ..database import get_supabase_client
from ..schemas.<name> import <Name>Response  # create schema as needed

router = APIRouter(prefix="/<name>", tags=["<name>"])


@router.get("/", response_model=list[<Name>Response])
async def list_<name>(
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """List all <name> records for the current user."""
    result = supabase.table("<name>").select("*").eq("user_id", current_user["id"]).execute()
    return result.data
```

Adjust the schema import and table name based on what the user is building.

## Step 2: Register in main.py
Open `/Users/vrln/adizes-backend/main.py` and add:
```python
from app.routers.<name> import router as <name>_router
app.include_router(<name>_router)
```
Place it alongside the other `include_router` calls.

## Step 3: Create schema file (if needed)
If a new schema is needed, create `/Users/vrln/adizes-backend/app/schemas/<name>.py`:
```python
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

class <Name>Response(BaseModel):
    id: UUID
    # add fields here
    created_at: datetime
```

## Step 4: Remind about rebuild
```
Router created. Since Python files are baked into the Docker image:
  cd /Users/vrln/adizes-backend && docker compose up --build -d
```
