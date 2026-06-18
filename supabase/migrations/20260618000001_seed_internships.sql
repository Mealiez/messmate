-- Seed initial internship roles
INSERT INTO internships (title, description, responsibilities, tech_stack, icon_type, icon_color, bg_color, is_active)
VALUES 
(
    'UI/UX Designer', 
    'Design intuitive interfaces and user experiences for our web and mobile platforms.', 
    ARRAY[
        'Design wireframes, prototypes, and high-fidelity mockups using Figma.',
        'Collaborate with developers to ensure accurate implementation.',
        'Conduct user research to improve UX flow.',
        'Create responsive designs for Mobile and Web.'
    ],
    ARRAY['Figma', 'Adobe XD', 'Sketch', 'Prototyping', 'User Research'],
    'design', 
    'text-purple-600', 
    'bg-purple-100', 
    true
),
(
    'React Developer', 
    'Build responsive and dynamic frontend components using React, Tailwind, and Vite.', 
    ARRAY[
        'Develop reusable components using React.js and TypeScript.',
        'Style applications using Tailwind CSS.',
        'Integrate APIs and handle state management.',
        'Optimize application performance and fix bugs.'
    ],
    ARRAY['React JS', 'TypeScript', 'Tailwind CSS', 'Vite', 'Redux / Context API'],
    'code', 
    'text-blue-600', 
    'bg-blue-100', 
    true
),
(
    'Backend Developer', 
    'Manage database architecture, API integration, and server-side logic with Supabase.', 
    ARRAY[
        'Design and maintain PostgreSQL database schemas.',
        'Write optimized SQL queries and RLS policies.',
        'Manage Authentication and Edge Functions.',
        'Ensure data security and system reliability.'
    ],
    ARRAY['Node.js', 'Supabase', 'PostgreSQL', 'Express', 'Deno', 'Python'],
    'database', 
    'text-green-600', 
    'bg-green-100', 
    true
);

-- Create intern_hire table if it doesn't exist (used for applications)
CREATE TABLE IF NOT EXISTS intern_hire (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    phone text NOT NULL,
    email text NOT NULL,
    college text NOT NULL,
    year text NOT NULL,
    branch text NOT NULL,
    tech_stack text[] DEFAULT '{}',
    resume_url text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS on intern_hire
ALTER TABLE intern_hire ENABLE ROW LEVEL SECURITY;

-- Allow public to insert (apply for internship)
CREATE POLICY "Anyone can apply for an internship" 
    ON intern_hire FOR INSERT 
    WITH CHECK (true);

-- Allow admins to read/manage applications
CREATE POLICY "Admins can view intern applications" 
    ON intern_hire FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );
