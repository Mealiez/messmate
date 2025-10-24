/*
  # Mess Management System Database Schema

  ## Overview
  Creates a complete database structure for a digital mess management system with RFID-based attendance,
  billing, menu management, and role-based access control.

  ## 1. New Tables

  ### `user_profiles`
  Extends auth.users with role and additional profile information
  - `id` (uuid, primary key, references auth.users)
  - `role` (text) - admin, student, or parent
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `students`
  Student records with mess enrollment details
  - `id` (uuid, primary key)
  - `user_id` (uuid, references user_profiles) - linked auth user
  - `name` (text)
  - `email` (text, unique)
  - `mobile` (text)
  - `rfid_tag` (text, unique)
  - `plan_type` (text) - Monthly or Weekly
  - `room_no` (text)
  - `status` (text) - Active or Inactive
  - `parent_id` (uuid, nullable, references user_profiles) - linked parent account
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `attendance`
  Daily attendance records
  - `id` (uuid, primary key)
  - `student_id` (uuid, references students)
  - `date` (date)
  - `status` (text) - Present or Absent
  - `marked_at` (timestamptz)
  - Unique constraint on (student_id, date) to prevent duplicates

  ### `payments`
  Payment and billing records
  - `id` (uuid, primary key)
  - `student_id` (uuid, references students)
  - `amount` (numeric)
  - `status` (text) - Paid or Pending
  - `due_date` (date)
  - `paid_on` (date, nullable)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `menu`
  Daily meal menu
  - `id` (uuid, primary key)
  - `date` (date, unique)
  - `breakfast` (text)
  - `lunch` (text)
  - `dinner` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## 2. Security
  
  ### Row Level Security (RLS)
  All tables have RLS enabled with restrictive policies:
  
  - **user_profiles**: Users can read/update their own profile; admins can read all
  - **students**: Admins have full access; students can read their own record; parents can read their children's records
  - **attendance**: Admins have full access; students can read their own and insert (mark attendance); parents can read their children's
  - **payments**: Admins have full access; students can read their own; parents can read their children's
  - **menu**: Admins have full access; authenticated users can read

  ## 3. Indexes
  - Performance indexes on frequently queried columns
  - Foreign key indexes for joins
  
  ## 4. Functions
  - Helper function to check if user is admin
  - Trigger to auto-update `updated_at` timestamps
*/

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'student', 'parent')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  mobile text NOT NULL,
  rfid_tag text UNIQUE NOT NULL,
  plan_type text NOT NULL CHECK (plan_type IN ('Monthly', 'Weekly')),
  room_no text NOT NULL,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  parent_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'Present' CHECK (status IN ('Present', 'Absent')),
  marked_at timestamptz DEFAULT now(),
  UNIQUE(student_id, date)
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Paid', 'Pending')),
  due_date date NOT NULL,
  paid_on date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menu (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  date date UNIQUE NOT NULL,
  breakfast text NOT NULL DEFAULT '',
  lunch text NOT NULL DEFAULT '',
  dinner text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_parent_id ON students(parent_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_menu_date ON menu(date);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_profiles_updated_at') THEN
    CREATE TRIGGER update_user_profiles_updated_at
      BEFORE UPDATE ON user_profiles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_students_updated_at') THEN
    CREATE TRIGGER update_students_updated_at
      BEFORE UPDATE ON students
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_payments_updated_at') THEN
    CREATE TRIGGER update_payments_updated_at
      BEFORE UPDATE ON payments
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_menu_updated_at') THEN
    CREATE TRIGGER update_menu_updated_at
      BEFORE UPDATE ON menu
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can read all profiles" ON user_profiles;
CREATE POLICY "Admins can read all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins have full access to students" ON students;
CREATE POLICY "Admins have full access to students"
  ON students FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Students can read own record" ON students;
CREATE POLICY "Students can read own record"
  ON students FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Parents can read their children's records" ON students;
CREATE POLICY "Parents can read their children's records"
  ON students FOR SELECT
  TO authenticated
  USING (parent_id = auth.uid());

DROP POLICY IF EXISTS "Admins have full access to attendance" ON attendance;
CREATE POLICY "Admins have full access to attendance"
  ON attendance FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Students can read own attendance" ON attendance;
CREATE POLICY "Students can read own attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = attendance.student_id
      AND students.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can mark own attendance" ON attendance;
CREATE POLICY "Students can mark own attendance"
  ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = attendance.student_id
      AND students.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Parents can read their children's attendance" ON attendance;
CREATE POLICY "Parents can read their children's attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = attendance.student_id
      AND students.parent_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins have full access to payments" ON payments;
CREATE POLICY "Admins have full access to payments"
  ON payments FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Students can read own payments" ON payments;
CREATE POLICY "Students can read own payments"
  ON payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = payments.student_id
      AND students.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Parents can read their children's payments" ON payments;
CREATE POLICY "Parents can read their children's payments"
  ON payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = payments.student_id
      AND students.parent_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins have full access to menu" ON menu;
CREATE POLICY "Admins have full access to menu"
  ON menu FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Authenticated users can read menu" ON menu;
CREATE POLICY "Authenticated users can read menu"
  ON menu FOR SELECT
  TO authenticated
  USING (true);
