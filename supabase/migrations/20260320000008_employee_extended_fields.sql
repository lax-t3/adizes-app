-- migrations/008_employee_extended_fields.sql
-- Adds 9 HR profile columns to org_employees.
-- All new NOT NULL columns have defaults so existing rows are migrated safely.

ALTER TABLE org_employees
  ADD COLUMN last_name        text,
  ADD COLUMN middle_name      text,
  ADD COLUMN gender           text,
  ADD COLUMN default_language text    NOT NULL DEFAULT 'English',
  ADD COLUMN manager_email    text,
  ADD COLUMN dob              date,
  ADD COLUMN emp_date         date,
  ADD COLUMN head_of_dept     boolean NOT NULL DEFAULT false,
  ADD COLUMN emp_status       text    NOT NULL DEFAULT 'Active'
    CONSTRAINT emp_status_check
      CHECK (emp_status IN ('Active','Inactive','On Leave','Probation','Resigned'));
