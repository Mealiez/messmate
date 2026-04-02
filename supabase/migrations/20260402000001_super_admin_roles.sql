-- Add super_admin policies to allow HR access to all tenants and tenant_features

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'hr')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tenants: Super admins can read and update all
CREATE POLICY "Super Admins can read all tenants" ON tenants
  FOR SELECT TO authenticated USING (is_super_admin());

CREATE POLICY "Super Admins can update all tenants" ON tenants
  FOR UPDATE TO authenticated USING (is_super_admin());

-- Tenant Features: Super admins can manage all
CREATE POLICY "Super Admins can manage all tenant features" ON tenant_features
  FOR ALL TO authenticated USING (is_super_admin());

-- Also grant insert/update to features if needed
CREATE POLICY "Super Admins can manage all features" ON features
  FOR ALL TO authenticated USING (is_super_admin());
