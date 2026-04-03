-- 20260402000002_subscription_plans.sql

-- 1. Create Subscription Plans Table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    price_monthly DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Plan Features Map
CREATE TABLE IF NOT EXISTS plan_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_name VARCHAR(255) REFERENCES subscription_plans(name) ON DELETE CASCADE,
    feature_id VARCHAR(255) REFERENCES features(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(plan_name, feature_id)
);

-- 3. Update User Profiles
-- Add payment_status to track if custom plans have paid
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid';

-- Note: We assume user_profiles already has `subscription_plan` (or `plan`) from previous iterations.
-- Ensure we have subscription_plan column
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(255) DEFAULT 'free';

-- 4. Initial Seed for Plans
INSERT INTO subscription_plans (name, description, price_monthly)
VALUES 
    ('starter', 'Student & Attendance Management', 999.00),
    ('pro', 'Full Suite including Reporting', 1999.00),
    ('custom', 'Custom Solution requires HR contact', NULL),
    ('free', 'Basic Mess Listing', 0.00)
ON CONFLICT (name) DO NOTHING;

-- 4.5 Ensure all features exist in the 'features' table
INSERT INTO features (id, name, description)
VALUES 
    ('student_management', 'Student Management', 'Manage student profiles and meal plans'),
    ('qr_attendance', 'QR Attendance', 'Track student attendance using QR codes'),
    ('billing', 'Billing Module', 'Handle student payments and dues'),
    ('menu_management', 'Menu Management', 'Manage daily mess meals and schedules')
ON CONFLICT (id) DO NOTHING;

-- 5. Seed Base Plan Features based on our app logic
-- starter: student_management, qr_attendance
-- pro: all features
INSERT INTO plan_features (plan_name, feature_id)
VALUES 
    ('starter', 'student_management'),
    ('starter', 'qr_attendance'),
    ('pro', 'student_management'),
    ('pro', 'qr_attendance'),
    ('pro', 'billing'),
    ('pro', 'menu_management')
ON CONFLICT (plan_name, feature_id) DO NOTHING;

-- 6. RLS Policies
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;

-- Everyone can view plans
CREATE POLICY "Public read plans" ON subscription_plans FOR SELECT USING (true);
CREATE POLICY "Public read plan features" ON plan_features FOR SELECT USING (true);

-- Only Super Admins (HR) can modify plans
CREATE POLICY "Admin modify plans" ON subscription_plans FOR ALL USING (is_super_admin());
CREATE POLICY "Admin modify plan features" ON plan_features FOR ALL USING (is_super_admin());

-- Notice for testing: The HR user will be setting `payment_status = 'paid'` on `user_profiles` directly.
-- user_profiles already has policies, but we should make sure HR can update `payment_status` and `subscription_plan` for anyone.
CREATE POLICY "HR update user profiles" ON user_profiles FOR UPDATE USING (is_super_admin());
