/*
  # Multi-Tenant, Feature Flag, and Meal Request Migration

  1. New Tables
     - `tenants`: Stores mess details.
     - `features`: Available features across the platform.
     - `tenant_features`: Enables features for specific tenants.
     - `custom_config`: Tenant specific configurations.
     - `meal_requests`: Stores student pre-attendance requests.

  2. Modifications
     - Adds `tenant_id` to all existing tables (user_profiles, students, attendance, payments, menu).
     - Assigns existing data to a 'Default Mess' tenant.

  3. Security
     - Adds RLS policies to restrict data access based on `tenant_id`.
     - Provides helper functions for tenant context and feature checking.
*/

-- 1. Create Control Layer Tables
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  plan text NOT NULL DEFAULT 'free',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS features (
  id text PRIMARY KEY, -- e.g., 'billing', 'meal_requests'
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_features (
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  feature_id text REFERENCES features(id) ON DELETE CASCADE,
  enabled boolean DEFAULT true,
  PRIMARY KEY (tenant_id, feature_id)
);

CREATE TABLE IF NOT EXISTS custom_config (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- 2. Create Default Tenant for Migration
INSERT INTO tenants (id, name, slug, plan)
VALUES ('00000000-0000-0000-0000-000000000000', 'Default Mess', 'default-mess', 'premium')
ON CONFLICT DO NOTHING;

-- 3. Add tenant_id to existing tables

-- First, add columns (nullable for existing data)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE menu ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT;

-- Set default tenant for existing records
UPDATE user_profiles SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
UPDATE students SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
UPDATE attendance SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
UPDATE payments SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
UPDATE menu SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;

-- Now alter to NOT NULL
ALTER TABLE user_profiles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE students ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE attendance ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE payments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE menu ALTER COLUMN tenant_id SET NOT NULL;

-- 4. Create meal_requests table
CREATE TABLE IF NOT EXISTS meal_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  date date NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('Breakfast', 'Lunch', 'Dinner')),
  status text NOT NULL DEFAULT 'Requested' CHECK (status IN ('Requested', 'Fulfilled', 'Cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, date, meal_type)
);

CREATE INDEX IF NOT EXISTS idx_meal_requests_tenant ON meal_requests(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_tenant_features_tenant ON tenant_features(tenant_id);

-- 5. Triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tenants_updated_at') THEN
    CREATE TRIGGER update_tenants_updated_at
      BEFORE UPDATE ON tenants
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_custom_config_updated_at') THEN
    CREATE TRIGGER update_custom_config_updated_at
      BEFORE UPDATE ON custom_config
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_meal_requests_updated_at') THEN
    CREATE TRIGGER update_meal_requests_updated_at
      BEFORE UPDATE ON meal_requests
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;

-- 6. Helper Functions
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS uuid AS $$
BEGIN
  RETURN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_feature_enabled(check_tenant_id uuid, check_feature_id text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tenant_features
    WHERE tenant_id = check_tenant_id AND feature_id = check_feature_id AND enabled = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Basic Data for Features
INSERT INTO features (id, name, description) VALUES
('meal_requests', 'Meal Requests', 'Allow students to pre-request meals'),
('billing', 'Billing Module', 'Handle student payments and dues'),
('analytics', 'Analytics', 'Advanced reporting for mess owners')
ON CONFLICT (id) DO NOTHING;

-- Enable meal_requests for default tenant
INSERT INTO tenant_features (tenant_id, feature_id, enabled) VALUES
('00000000-0000-0000-0000-000000000000', 'meal_requests', true),
('00000000-0000-0000-0000-000000000000', 'billing', true)
ON CONFLICT DO NOTHING;

-- 8. Enable RLS and setup initial tenant policies
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE features ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_requests ENABLE ROW LEVEL SECURITY;

-- Admins can see their tenant info
CREATE POLICY "Users can read their own tenant" ON tenants
  FOR SELECT TO authenticated USING (id = get_user_tenant_id() OR is_admin());

-- Everyone can see features
CREATE POLICY "Authenticated users can read features" ON features
  FOR SELECT TO authenticated USING (true);

-- Users can see their tenant's features
CREATE POLICY "Users can read their tenant features" ON tenant_features
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id() OR is_admin());

-- Users can see their tenant's custom config
CREATE POLICY "Users can read their tenant config" ON custom_config
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id() OR is_admin());

-- Drop old policies to replace with tenant-aware ones
DROP POLICY IF EXISTS "Admins have full access to students" ON students;
DROP POLICY IF EXISTS "Admins have full access to attendance" ON attendance;
DROP POLICY IF EXISTS "Admins have full access to payments" ON payments;
DROP POLICY IF EXISTS "Admins have full access to menu" ON menu;

-- Admins can manage data in their tenant
CREATE POLICY "Admins full access to students in tenant" ON students
  TO authenticated USING (is_admin() AND tenant_id = get_user_tenant_id());
  
CREATE POLICY "Admins full access to attendance in tenant" ON attendance
  TO authenticated USING (is_admin() AND tenant_id = get_user_tenant_id());

CREATE POLICY "Admins full access to payments in tenant" ON payments
  TO authenticated USING (is_admin() AND tenant_id = get_user_tenant_id());
  
CREATE POLICY "Admins full access to menu in tenant" ON menu
  TO authenticated USING (is_admin() AND tenant_id = get_user_tenant_id());

-- Meal Requests Policies
CREATE POLICY "Admins full access meal requests" ON meal_requests
  FOR ALL TO authenticated USING (is_admin() AND tenant_id = get_user_tenant_id());

CREATE POLICY "Students can manage own meal requests via feature flag" ON meal_requests
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = meal_requests.student_id
      AND students.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = meal_requests.student_id
      AND students.user_id = auth.uid()
    )
    AND check_feature_enabled(meal_requests.tenant_id, 'meal_requests')
  );
