import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Mail, 
  Lock, 
  Phone, 
  Building, 
  School, 
  Key, 
  ArrowRight, 
  CheckCircle2, 
  ChevronRight,
  ShieldCheck,
  UserCheck
} from 'lucide-react';

const Register: React.FC = () => {
  const [role, setRole] = useState('student');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [roomNo, setRoomNo] = useState('');
  const [college, setCollege] = useState('');
  const [messId, setMessId] = useState('');
  const [planType, setPlanType] = useState('');
  const [adminPlan, setAdminPlan] = useState('free');
  const [licenseKey, setLicenseKey] = useState('');
  
  const [availablePlans, setAvailablePlans] = useState<{name: string, price: number}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlans = async () => {
      if (role !== 'student' || !messId.trim()) {
        setAvailablePlans([]);
        return;
      }
      const { data } = await supabase.from('plans').select('name, price').eq('mess_id', messId);
      if (data) setAvailablePlans(data);
    };

    const timer = setTimeout(fetchPlans, 500);
    return () => clearTimeout(timer);
  }, [messId, role]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
              data: { full_name: name } 
          }
      });

      if (signUpError) throw signUpError;

      if (data.session) {
          await createDatabaseRecords(data.user!.id);
      } else {
          setShowOtp(true);
      }
    } catch (err: any) {
      setError(err.message || 'Error creating account');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setOtpError(null);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: otpCode,
          type: 'signup'
      });

      if (error) throw error;
      if (data.user) {
        await createDatabaseRecords(data.user.id);
      }

    } catch (err: any) {
      setOtpError(err.message || 'Invalid OTP');
      setIsLoading(false);
    }
  };

  const createDatabaseRecords = async (userId: string) => {
    try {
      const { error: profileError } = await supabase.from('user_profiles').insert({ 
          id: userId, 
          role: role, 
          full_name: name,
          subscription_plan: adminPlan 
      });
      if (profileError) throw profileError;

      if (role === 'student') {
          const { error: studentError } = await supabase.from('students').insert({
              user_id: userId, 
              name: name, 
              email: email, 
              mobile: mobile,
              plan_type: planType || null, 
              room_no: roomNo, 
              status: 'Active', 
              mess_id: messId || null, 
              college: college
          });
          if (studentError) throw studentError;
      }

      alert("Verification Successful! Logging in...");
      if (role === 'student') window.location.href = '/student-dashboard.html';
      else if (role === 'admin') window.location.href = '/admin-dashboard.html';
      else window.location.href = '/parent-dashboard.html';

    } catch (err: any) {
      console.error(err);
      setError("Account created, but profile setup failed: " + err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen flex items-center justify-center p-4 font-sans text-gray-800">
      <div className={`bg-white rounded-lg shadow-md w-full max-w-2xl p-8 my-8 relative border border-gray-200 ${showOtp ? 'opacity-50 pointer-events-none' : ''}`}>
        
        <div className="text-center mb-10 border-b pb-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-2 tracking-tight">Create Account</h1>
            <p className="text-gray-500 font-medium italic">Join the Mealiez Mess Network</p>
        </div>

        {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 font-semibold shadow-sm animate-pulse">
                ⚠️ {error}
            </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
            <div>
                <label className="block text-gray-700 font-bold mb-2">Register As</label>
                <select 
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 transition font-bold text-blue-700 bg-white"
                >
                    <option value="student">Student</option>
                    <option value="parent">Parent</option>
                    <option value="admin">Admin (Owner)</option>
                </select>
            </div>
            
            {role === 'admin' && (
                <div className="space-y-4 border-2 border-red-50 p-4 rounded-xl">
                    <div>
                        <label className="block text-gray-700 font-bold mb-2 uppercase text-xs tracking-widest">Choose Admin Plan</label>
                        <select 
                            value={adminPlan}
                            onChange={(e) => setAdminPlan(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold"
                        >
                            <option value="free">Free (List Mess Only)</option>
                            <option value="starter">Starter (Manage Students & Attendance)</option>
                            <option value="pro">Pro (Full Access + Reports)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-gray-700 font-bold mb-2 uppercase text-xs tracking-widest">License Key</label>
                        <input 
                            type="password" 
                            required
                            value={licenseKey}
                            onChange={(e) => setLicenseKey(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-red-500 outline-none transition" 
                            placeholder="Enter mess license key"
                        />
                    </div>
                </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-gray-700 font-bold mb-2">Full Name</label>
                    <input 
                        type="text" 
                        required 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-blue-500 shadow-sm" 
                        placeholder="John Doe" 
                    />
                </div>
                <div>
                    <label className="block text-gray-700 font-bold mb-2">Email</label>
                    <input 
                        type="email" 
                        required 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-blue-500 shadow-sm" 
                        placeholder="john@example.com" 
                    />
                </div>
            </div>

            {role === 'student' && (
                <div className="space-y-4 border-t border-gray-100 pt-4 mt-2">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-700 font-bold mb-2">Mobile Number</label>
                            <input 
                                type="tel" 
                                required 
                                pattern="[0-9]{10}"
                                value={mobile}
                                onChange={(e) => setMobile(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl" 
                                placeholder="10 digit number"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-700 font-bold mb-2">Room Number</label>
                            <input 
                                type="text" 
                                required
                                value={roomNo}
                                onChange={(e) => setRoomNo(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl" 
                                placeholder="e.g. 101"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-gray-700 font-bold mb-2">College Name</label>
                        <input 
                            type="text" 
                            required
                            value={college}
                            onChange={(e) => setCollege(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl" 
                            placeholder="Your College/University"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 font-bold mb-2">Mess ID (Optional)</label>
                        <input 
                            type="text" 
                            value={messId}
                            onChange={(e) => setMessId(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl font-mono text-xs uppercase" 
                            placeholder="Leave empty if not joining a mess" 
                        />
                    </div>
                    {availablePlans.length > 0 && (
                        <div>
                            <label className="block text-gray-700 font-bold mb-2">Plan Type</label>
                            <select 
                                value={planType}
                                onChange={(e) => setPlanType(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold shadow-inner"
                            >
                                <option value="" disabled>Select Plan</option>
                                {availablePlans.map((p, idx) => (
                                    <option key={idx} value={p.name}>{p.name} (₹{p.price})</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            )}

            <div className="grid md:grid-cols-2 gap-4 border-t border-gray-100 pt-4 shadow-inner px-2 py-2 rounded-xl bg-gray-50/50">
                <div>
                    <label className="block text-gray-700 font-bold mb-2">Password</label>
                    <input 
                        type="password" 
                        required 
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-blue-500" 
                    />
                </div>
                <div>
                    <label className="block text-gray-700 font-bold mb-2">Confirm Password</label>
                    <input 
                        type="password" 
                        required 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-blue-500" 
                    />
                </div>
            </div>

            <button 
                type="submit" 
                disabled={isLoading}
                className="w-full mt-6 bg-blue-600 text-white py-4 flex justify-center items-center rounded-xl font-extrabold text-lg hover:bg-blue-700 transition transform hover:scale-[1.01] shadow-xl disabled:opacity-50"
            >
                {isLoading ? 'Sending OTP...' : 'Register Account'}
            </button>
            {role === 'student' && <p className="mt-4 text-center text-red-600 font-bold text-xs italic">Enter Mess ID only if joining now.</p>}
        </form>

        <div className="mt-8 text-center border-t pt-6">
            <p className="text-gray-600 font-medium italic">Already have an account? <a href="/login.html" className="text-blue-600 font-bold hover:underline">Login here</a></p>
        </div>
      </div>

      {showOtp && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-80 z-50 flex flex-col justify-center items-center p-8 animate-fade-in backdrop-blur-sm">
            <div className="bg-white p-10 rounded-2xl text-center w-full max-w-sm shadow-2xl relative border-4 border-green-50">
                <div className="bg-green-100 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 shadow-sm">
                    <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                    </svg>
                </div>
                <h2 className="text-3xl font-black text-gray-900 mb-2">Verify Email</h2>
                <p className="text-gray-500 mb-8 font-medium">We've sent a code to <br /><span className="text-blue-600 font-bold">{email}</span></p>
                
                <form onSubmit={verifyOtp} className="space-y-6">
                    <input 
                      type="text" 
                      required 
                      maxLength={6} 
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-full text-center text-4xl font-black tracking-widest px-4 py-4 border-b-4 border-gray-100 rounded-lg focus:border-green-500 focus:ring-0 outline-none bg-gray-50" 
                      placeholder="000000" 
                    />
                    <button 
                      type="submit" 
                      disabled={isLoading}
                      className="w-full bg-green-600 text-white py-4 rounded-xl font-black text-xl hover:bg-green-700 transition transform hover:scale-[1.02] active:scale-100 shadow-xl disabled:opacity-50"
                    >
                        {isLoading ? 'Verifying...' : 'Complete Registration'}
                    </button>
                </form>
                {otpError && <p className="text-red-500 font-bold text-sm mt-4 bg-red-50 p-2 rounded">{otpError}</p>}
                <button onClick={() => setShowOtp(false)} className="mt-8 text-gray-400 font-bold text-sm hover:text-gray-800 transition">← Change Email</button>
            </div>
        </div>
      )}
    </div>
  );
};

export default Register;
