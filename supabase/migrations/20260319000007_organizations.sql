-- migrations/007_organizations.sql

-- Organizations: one record per client company
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Org nodes: unlimited-depth hierarchy via materialized path
-- path format: "<org_id>/<root_node_id>[/<child_id>...]"
-- is_root=true marks the single root node per org (the company itself)
CREATE TABLE org_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES org_nodes(id) ON DELETE RESTRICT,
  is_root boolean NOT NULL DEFAULT false,
  path text NOT NULL,
  name text NOT NULL,
  node_type text DEFAULT 'department',
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX org_nodes_org_id_idx ON org_nodes(org_id);
CREATE INDEX org_nodes_path_idx ON org_nodes(path text_pattern_ops);
CREATE INDEX org_nodes_parent_id_idx ON org_nodes(parent_id);
-- Enforces exactly one root per org; app guard checks is_root before allowing delete
CREATE UNIQUE INDEX org_nodes_one_root_per_org ON org_nodes(org_id) WHERE is_root = true;

-- Org employees: one row per user per org (UNIQUE org_id+user_id allows same user in multiple orgs)
CREATE TABLE org_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES org_nodes(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id text,
  title text,
  joined_at timestamptz DEFAULT now(),
  UNIQUE (org_id, user_id)
);
CREATE INDEX org_employees_org_id_idx ON org_employees(org_id);
CREATE INDEX org_employees_node_id_idx ON org_employees(node_id);
CREATE INDEX org_employees_user_id_idx ON org_employees(user_id);

-- Cohort <-> org junction (many-to-many)
CREATE TABLE cohort_organizations (
  cohort_id uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  linked_at timestamptz DEFAULT now(),
  PRIMARY KEY (cohort_id, org_id)
);
