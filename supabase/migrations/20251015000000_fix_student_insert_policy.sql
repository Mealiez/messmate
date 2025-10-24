/*
  # Fix Student Registration Issue

  ## Changes
  - Add missing INSERT policy for students table to allow users to create their own student record during registration

  ## Security
  - Policy ensures users can only insert records with their own user_id
  - Maintains data integrity and security
*/

DROP POLICY IF EXISTS "Users can insert own student record" ON students;
CREATE POLICY "Users can insert own student record"
  ON students FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
