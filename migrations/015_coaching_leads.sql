-- 015_coaching_leads.sql
-- Lead-capture for LEAP™ Coaching (the /leap-coaching "Schedule a Conversation" form).
-- Apply: local via psql, production via Supabase MCP execute_sql / Dashboard SQL editor.

create table if not exists coaching_leads (
    id            uuid primary key default gen_random_uuid(),
    name          text not null,
    email         text not null,
    phone         text,
    organization  text,
    message       text,
    source        text not null default 'leap-coaching',
    actioned      boolean not null default false,
    actioned_at   timestamptz,
    actioned_by   uuid,
    created_at    timestamptz not null default now()
);

create index if not exists idx_coaching_leads_created_at on coaching_leads (created_at desc);
create index if not exists idx_coaching_leads_actioned   on coaching_leads (actioned);

-- Only the service-role backend touches this table; RLS on + no policies blocks
-- the anon/public key entirely (service_role bypasses RLS).
alter table coaching_leads enable row level security;
