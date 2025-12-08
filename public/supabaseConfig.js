import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.7/+esm';

const supabaseUrl = 'https://nsugvvqrufqzgwoyylfe.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zdWd2dnFydWZxemd3b3l5bGZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NDUxMDAsImV4cCI6MjA3NTIyMTEwMH0.PIkfTjggX_FOVydWDlGYdINzPy1XRsQc8UGud6JEbGo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
