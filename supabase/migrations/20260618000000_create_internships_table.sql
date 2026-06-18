/*
  # Create Internships Table

  ## 1. New Tables
  ### `internships`
  - `id` (uuid, primary key)
  - `title` (text) - The job title (e.g., UI/UX Designer)
  - `description` (text) - A short summary of the role
  - `responsibilities` (text[]) - Array of key responsibilities
  - `icon_type` (text) - Category for icon selection
  - `icon_color` (text) - Tailwind class for icon color
  - `bg_color` (text) - Tailwind class for background color
  - `is_active` (boolean) - Whether the role is currently open
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## 2. Security
  - Enable RLS on `internships` table
  - Add policy for public read access
  - Add policy for admin full access
*/

CREATE TABLE IF NOT EXISTS internships (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text NOT NULL,
  responsibilities text[] DEFAULT '{}',
  tech_stack text[] DEFAULT '{}',
  icon_type text DEFAULT 'code',
  icon_color text DEFAULT 'text-blue-600',
  bg_color text DEFAULT 'bg-blue-100',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE internships ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Internships are viewable by everyone" 
  ON internships FOR SELECT 
  USING (true);

-- Admin full access (using the existing role check if possible, or just authenticated for now if admin role is complex)
-- Based on previous migrations, we have a user_profiles table with roles.
CREATE POLICY "Admins can manage internships" 
  ON internships FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_internships_updated_at
    BEFORE UPDATE ON internships
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
