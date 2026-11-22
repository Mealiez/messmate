-- Update policy for internships to allow HR and Super Admins to manage them
-- The previous policy only allowed 'admin' role, but internships are managed in the HR dashboard.

DROP POLICY IF EXISTS "Admins can manage internships" ON internships;

CREATE POLICY "Admins and HR can manage internships" 
  ON internships FOR ALL 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'hr', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'hr', 'super_admin')
    )
  );

-- Also update intern_hire policy to allow HR and Super Admins to view applications
DROP POLICY IF EXISTS "Admins can view intern applications" ON intern_hire;

CREATE POLICY "Admins and HR can view intern applications" 
    ON intern_hire FOR ALL 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role IN ('admin', 'hr', 'super_admin')
        )
    );
