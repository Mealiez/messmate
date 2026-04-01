import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, LogIn, ArrowRight, ShieldCheck, UserCircle } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) throw new Error(authError.message);
      if (!authData.user) throw new Error('No user data returned.');

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError) throw new Error('Failed to fetch user profile');
      if (!profile) throw new Error('User profile not found.');

      // --- SECRET HR LOGIC ---
      if (profile.role === 'hr') {
        window.location.href = '/hrdashboard.html';
        return;
      }

      // Normal check
      if (profile.role !== role) {
        await supabase.auth.signOut();
        throw new Error(`You are not registered as ${role}. Please select the correct role.`);
      }

      // Standard Redirections
      switch (profile.role) {
        case 'admin':
          window.location.href = '/admin-dashboard.html';
          break;
        case 'student':
          window.location.href = '/student-dashboard.html';
          break;
        case 'parent':
          window.location.href = '/parent-dashboard.html';
          break;
        default:
          throw new Error('Invalid user role');
      }

    } catch (err: any) {
      setError(err.message || 'An error occurred during login.');
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen flex items-center justify-center p-4 antialiased font-sans">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src="/assets/logo.png" alt="Mealiez Logo" className="h-16 w-16" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Login to Mealiez</h1>
          <p className="text-gray-600 font-medium">Sign in to your account</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 animate-pulse">
            <span className="font-semibold text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition outline-none"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition outline-none"
              placeholder="Enter your password"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">Login As</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition outline-none font-bold text-blue-800 bg-white"
            >
              <option value="student">Student</option>
              <option value="admin">Admin</option>
              <option value="parent">Parent</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3.5 rounded-lg font-bold text-lg hover:bg-blue-700 transition transform hover:scale-[1.02] active:scale-100 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Don't have an account?{' '}
            <a href="/register.html" className="text-blue-600 font-bold hover:underline transition">Register here</a>
          </p>
          <a href="/index.html" className="inline-block mt-4 text-gray-500 hover:text-gray-700 font-medium transition text-sm">
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
};

export default Login;
