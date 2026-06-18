-- Migration to add tech_stack column to internships table
ALTER TABLE internships ADD COLUMN IF NOT EXISTS tech_stack text[] DEFAULT '{}';

-- Update initial roles with default tech stack data
UPDATE internships 
SET tech_stack = ARRAY['Figma', 'Adobe XD', 'Sketch', 'Prototyping', 'User Research'] 
WHERE title = 'UI/UX Designer';

UPDATE internships 
SET tech_stack = ARRAY['React JS', 'TypeScript', 'Tailwind CSS', 'Vite', 'Redux / Context API'] 
WHERE title = 'React Developer';

UPDATE internships 
SET tech_stack = ARRAY['Node.js', 'Supabase', 'PostgreSQL', 'Express', 'Deno', 'Python'] 
WHERE title = 'Backend Developer';
