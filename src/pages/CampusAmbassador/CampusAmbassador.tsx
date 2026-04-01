import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Home, 
    CheckSquare, 
    Wallet, 
    Info, 
    BookOpen, 
    History, 
    Menu, 
    X, 
    LogOut, 
    ArrowLeft,
    Trophy,
    Target,
    Award,
    TrendingUp
} from 'lucide-react';

type Section = 'home' | 'tasks' | 'earnings' | 'details' | 'guide' | 'activity';

interface CATask { id: string; title: string; description: string; default_points: number; }
interface Submission { id: string; task_id: string; status: string; task: { title: string } | null; submitted_at: string; points_awarded: number; }
interface CAData { id: string; total_points: number; status: string; student_id: string; }

const CampusAmbassador: React.FC = () => {
    const { user, profile, loading } = useAuth('student');
    const [section, setSection] = useState<Section>('home');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [caData, setCAData] = useState<CAData | null>(null);
    const [caRank, setCArank] = useState<number | null>(null);
    const [tasks, setTasks] = useState<CATask[]>([]);
    const [history, setHistory] = useState<Submission[]>([]);
    const [withdrawPoints, setWithdrawPoints] = useState('');
    const [submitModal, setSubmitModal] = useState<CATask | null>(null);
    const [reportFile, setReportFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (user) loadCA();
    }, [user]);

    const loadCA = async () => {
        const { data } = await supabase.from('campus_ambassadors').select('*').eq('student_id', user!.id).maybeSingle();
        if (!data || data.status !== 'approved') {
            alert('You are not part of the Campus Ambassador program.'); 
            window.location.href = '/student-dashboard.html'; 
            return;
        }
        setCAData(data);

        const { data: allCAs } = await supabase.from('campus_ambassadors').select('id, total_points').eq('status', 'approved').order('total_points', { ascending: false });
        if (allCAs) {
            const idx = allCAs.findIndex(ca => ca.id === data.id);
            setCArank(idx + 1);
        }

        loadTasks();
        loadHistory(data.id);
    };

    const loadTasks = async () => {
        const { data } = await supabase.from('ca_tasks').select('*').order('created_at', { ascending: false });
        setTasks(data || []);
    };

    const loadHistory = async (caId: string) => {
        const { data } = await supabase.from('ca_submissions').select('*, task:ca_tasks(title)').eq('ca_id', caId).order('submitted_at', { ascending: false });
        setHistory(data || []);
    };

    const requestWithdrawal = async () => {
        const pts = parseInt(withdrawPoints);
        if (!pts || pts < 500) { alert('Minimum withdrawal is 500 points.'); return; }
        if (pts > (caData?.total_points || 0)) { alert('Insufficient points.'); return; }

        const amountInr = Math.floor(pts / 100) * 10;
        const { error: wError } = await supabase.from('withdrawals').insert({ 
            ca_id: caData!.id, 
            amount_points: pts, 
            amount_inr: amountInr, 
            status: 'pending' 
        });
        if (wError) { alert(wError.message); return; }
        
        await supabase.from('campus_ambassadors').update({ total_points: (caData?.total_points || 0) - pts }).eq('id', caData!.id);
        alert('Withdrawal request submitted!');
        setWithdrawPoints('');
        loadCA();
    };

    const handleTaskSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!submitModal || !reportFile || !caData) return;
        setSubmitting(true);

        const fileName = `ca-proofs/${caData.id}/${Date.now()}-${reportFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('ca-reports').upload(fileName, reportFile);
        if (uploadError) { alert('Upload failed: ' + uploadError.message); setSubmitting(false); return; }

        const { data: { publicUrl } } = supabase.storage.from('ca-reports').getPublicUrl(uploadData.path);
        const { error } = await supabase.from('ca_submissions').insert({ 
            ca_id: caData.id, 
            task_id: submitModal.id, 
            report_url: publicUrl, 
            status: 'pending' 
        });
        
        if (error) { 
            alert(error.message); 
        } else { 
            alert('Task submitted for review!'); 
            setSubmitModal(null); 
            setReportFile(null); 
            loadHistory(caData.id); 
        }
        setSubmitting(false);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center font-sans">Loading Portal...</div>;

    const walletBalance = Math.floor((caData?.total_points || 0) / 100) * 10;
    const progressPct = Math.min(((caData?.total_points || 0) / 500) * 100, 100);

    const switchSection = (s: Section) => {
        setSection(s);
        setMobileMenuOpen(false);
    };

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50 font-sans text-gray-800">
            
            {/* Sidebar - Matching Legacy Layout */}
            <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col z-10">
                <div className="p-6 flex items-center border-b border-gray-100">
                    <img src="/assets/logo.png" alt="Logo" className="h-8 w-8 mr-2" />
                    <span className="text-xl font-bold text-gray-900">CA Portal</span>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    <button onClick={() => switchSection('home')} className={`w-full flex items-center px-4 py-3 rounded-lg font-bold transition ${section === 'home' ? 'bg-orange-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>
                        <Home className="w-5 h-5 mr-3" />
                        Dashboard
                    </button>
                    
                    <button onClick={() => switchSection('tasks')} className={`w-full flex items-center px-4 py-3 rounded-lg font-bold transition ${section === 'tasks' ? 'bg-orange-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>
                        <CheckSquare className="w-5 h-5 mr-3" />
                        Tasks & Submissions
                    </button>

                    <button onClick={() => switchSection('earnings')} className={`w-full flex items-center px-4 py-3 rounded-lg font-bold transition ${section === 'earnings' ? 'bg-orange-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>
                        <Wallet className="w-5 h-5 mr-3" />
                        Withdrawals
                    </button>

                    <p className="px-4 text-[10px] font-black text-gray-400 uppercase mt-8 mb-2 tracking-widest">Resources</p>
                    
                    <button onClick={() => switchSection('details')} className={`w-full flex items-center px-4 py-3 rounded-lg font-bold transition ${section === 'details' ? 'bg-orange-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>
                        <Info className="w-5 h-5 mr-3" />
                        Program Details
                    </button>
                    
                    <button onClick={() => switchSection('guide')} className={`w-full flex items-center px-4 py-3 rounded-lg font-bold transition ${section === 'guide' ? 'bg-orange-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>
                        <BookOpen className="w-5 h-5 mr-3" />
                        How it Works
                    </button>
                    
                    <button onClick={() => switchSection('activity')} className={`w-full flex items-center px-4 py-3 rounded-lg font-bold transition ${section === 'activity' ? 'bg-orange-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>
                        <History className="w-5 h-5 mr-3" />
                        Recent Activity
                    </button>
                </nav>

                <div className="p-4 border-t border-gray-100">
                    <a href="/student-dashboard.html" className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-bold flex items-center justify-center">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to App
                    </a>
                </div>
            </aside>

            {/* Main Wrapper */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                
                {/* Mobile Header */}
                <header className="md:hidden bg-white border-b border-gray-200 p-4 flex justify-between items-center z-20">
                    <div className="flex items-center">
                        <img src="/assets/logo.png" alt="Logo" className="h-8 w-8 mr-2" />
                        <span className="font-bold text-gray-800">CA Portal</span>
                    </div>
                    <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-gray-600 focus:outline-none">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"/></svg>
                    </button>
                </header>

                {/* Mobile Nav Overlay */}
                {mobileMenuOpen && (
                    <div className="md:hidden absolute top-16 left-0 w-full bg-white border-b border-gray-200 z-30 shadow-xl">
                        <nav className="p-4 space-y-2">
                            <button onClick={() => switchSection('home')} className="block w-full text-left px-4 py-2 rounded-lg hover:bg-gray-50">Dashboard</button>
                            <button onClick={() => switchSection('tasks')} className="block w-full text-left px-4 py-2 rounded-lg hover:bg-gray-50">Tasks</button>
                            <button onClick={() => switchSection('earnings')} className="block w-full text-left px-4 py-2 rounded-lg hover:bg-gray-50">Withdrawals</button>
                            <button onClick={() => switchSection('details')} className="block w-full text-left px-4 py-2 rounded-lg hover:bg-gray-50">Program Rules</button>
                            <a href="/student-dashboard.html" className="block w-full text-left px-4 py-2 text-red-600">Back to App</a>
                        </nav>
                    </div>
                )}

                <main className="flex-1 overflow-y-auto bg-gray-50 p-6 md:p-8">
                    
                    {/* HOME SECTION */}
                    {section === 'home' && (
                        <div className="animate-fade-in">
                            <div className="flex justify-between items-end mb-6">
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900">Welcome back, {profile?.full_name?.split(' ')[0]}! 👋</h1>
                                    <p className="text-gray-500">Here's your performance summary.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 relative overflow-hidden">
                                     <div className="absolute top-0 right-0 p-4 opacity-5">
                                        <svg className="w-24 h-24 text-gray-900" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                                    </div>
                                    <div className="relative z-10">
                                        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Global Rank</p>
                                        <div className="flex items-baseline mt-2">
                                            <h2 className="text-4xl font-bold text-gray-900">#{caRank || '--'}</h2>
                                            <span className="ml-3 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full">Top Ambassador</span>
                                        </div>
                                        <p className="text-sm text-gray-400 mt-2">Keep completing tasks to climb up!</p>
                                    </div>
                                </div>

                                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white relative">
                                    <div className="relative z-10">
                                        <p className="text-sm font-medium text-blue-100 uppercase tracking-wide">Total Points</p>
                                        <h2 className="text-4xl font-bold mt-2">{caData?.total_points || 0}</h2>
                                        
                                        <div className="mt-4">
                                            <div className="flex justify-between text-xs text-blue-200 mb-1">
                                                <span>Progress to next tier</span>
                                                <span>500 pts target</span>
                                            </div>
                                            <div className="w-full bg-blue-900 bg-opacity-30 rounded-full h-2">
                                                <div className="bg-white h-2 rounded-full transition-all duration-1000" style={{ width: `${progressPct}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <h3 className="font-bold text-gray-800 mb-4">Quick Actions</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                <button onClick={() => switchSection('tasks')} className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition text-center group">
                                    <div className="w-10 h-10 mx-auto bg-orange-100 rounded-full flex items-center justify-center text-orange-600 mb-2 group-hover:scale-110 transition">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                                    </div>
                                    <span className="text-sm font-medium text-gray-700">Submit Task</span>
                                </button>
                                
                                <button onClick={() => switchSection('earnings')} className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition text-center group">
                                    <div className="w-10 h-10 mx-auto bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2 group-hover:scale-110 transition">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                                    </div>
                                    <span className="text-sm font-medium text-gray-700">Withdraw</span>
                                </button>

                                <a href="https://drive.google.com/drive/folders/1bcR7UBD72IAh80UXwWAYxUM0E63vH43L?usp=sharing" target="_blank" rel="noreferrer" className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition text-center group">
                                    <div className="w-10 h-10 mx-auto bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-2 group-hover:scale-110 transition">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                                    </div>
                                    <span className="text-sm font-medium text-gray-700">Assets</span>
                                </a>

                                <button onClick={() => switchSection('guide')} className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition text-center group">
                                    <div className="w-10 h-10 mx-auto bg-purple-100 rounded-full flex items-center justify-center text-purple-600 mb-2 group-hover:scale-110 transition">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                                    </div>
                                    <span className="text-sm font-medium text-gray-700">Rulebook</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* TASKS SECTION */}
                    {section === 'tasks' && (
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Available Tasks</h1>
                            <p className="text-gray-500 mb-6">Complete these tasks to earn points.</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {tasks.map(task => (
                                    <div key={task.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition group">
                                        <div className="flex justify-between items-start mb-3">
                                            <h3 className="font-bold text-gray-800">{task.title}</h3>
                                            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-[10px] font-bold uppercase whitespace-nowrap">{task.default_points} pts</span>
                                        </div>
                                        <p className="text-sm text-gray-500 mb-6 leading-relaxed">{task.description}</p>
                                        <button 
                                            onClick={() => setSubmitModal(task)}
                                            className="w-full bg-orange-600 text-white py-2.5 rounded-lg font-bold hover:bg-orange-700 transition shadow-sm text-sm"
                                        >
                                            Submit Proof
                                        </button>
                                    </div>
                                ))}
                                {tasks.length === 0 && <div className="col-span-full py-12 text-center text-gray-400">No active tasks found. Check back later!</div>}
                            </div>
                        </div>
                    )}

                    {/* EARNINGS SECTION */}
                    {section === 'earnings' && (
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-6">Withdrawals</h1>
                            
                            <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl mx-auto text-center border border-gray-200">
                                <div className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Wallet Balance</div>
                                <div className="text-5xl font-extrabold text-green-600 mb-2">₹{walletBalance}</div>
                                <p className="text-gray-500 mb-8 text-sm">Based on {caData?.total_points || 0} points (100 Pts = ₹10)</p>
                                
                                <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left border border-gray-100">
                                    <h3 className="font-bold text-gray-800 mb-4">Request Payout</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Points)</label>
                                            <input 
                                                type="number" 
                                                value={withdrawPoints}
                                                onChange={e => setWithdrawPoints(e.target.value)}
                                                placeholder="Min 500" 
                                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500" 
                                            />
                                            <p className="text-xs text-gray-400 mt-1">Minimum withdrawal: 500 Points (₹50)</p>
                                        </div>
                                        <button onClick={requestWithdrawal} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition shadow">
                                            Request Transfer
                                        </button>
                                    </div>
                                </div>

                                <p className="text-xs text-gray-400">Payments are processed by the 10th of every month.</p>
                            </div>
                        </div>
                    )}

                    {/* ACTIVITY SECTION */}
                    {section === 'activity' && (
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-6">Recent Activity</h1>
                            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                                        <tr>
                                            <th className="p-4">Task</th>
                                            <th className="p-4">Date</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4 text-right">Points</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-sm">
                                        {history.map(h => (
                                            <tr key={h.id}>
                                                <td className="p-4 font-bold text-gray-800">{h.task?.title || 'Unknown Task'}</td>
                                                <td className="p-4 text-gray-500">{new Date(h.submitted_at).toLocaleDateString()}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${h.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                        {h.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right font-bold text-blue-600">{h.status === 'approved' ? `+${h.points_awarded}` : '--'}</td>
                                            </tr>
                                        ))}
                                        {history.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-400">No activity yet. Complete tasks to see history.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* DETAILS SECTION */}
                    {section === 'details' && (
                        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-500 max-w-2xl">
                             <h3 className="text-xl font-bold text-gray-800 mb-4">Program Rules & Incentives</h3>
                             <ul className="space-y-4 text-gray-600 text-sm">
                                <li className="flex items-start">
                                    <span className="text-orange-500 mr-2 font-bold">●</span>
                                    Earn points by completing designated social media and offline marketing tasks.
                                </li>
                                <li className="flex items-start">
                                    <span className="text-orange-500 mr-2 font-bold">●</span>
                                    100 Points = ₹10 INR. Minimum withdrawal limit is 500 Points.
                                </li>
                                <li className="flex items-start">
                                    <span className="text-orange-500 mr-2 font-bold">●</span>
                                    Submissions must include clear proof (screenshots/links) to be approved by HR.
                                </li>
                                <li className="flex items-start">
                                    <span className="text-orange-500 mr-2 font-bold">●</span>
                                    Top performers (Top 5) get exclusive Mealiez swags and official certificates.
                                </li>
                                <li className="flex items-start">
                                    <span className="text-orange-500 mr-2 font-bold">●</span>
                                    Misuse of the portal or fake submissions will lead to immediate termination.
                                </li>
                             </ul>
                        </div>
                    )}

                    {/* GUIDE SECTION */}
                    {section === 'guide' && (
                        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500 max-w-2xl">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">Resources & Guide</h3>
                                    <p className="text-gray-500 mt-1">Download logos, templates, and read the tutorials.</p>
                                </div>
                                <div className="bg-blue-100 p-3 rounded-full">
                                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                                </div>
                            </div>
                            <a href="https://drive.google.com/drive/folders/1bcR7UBD72IAh80UXwWAYxUM0E63vH43L?usp=sharing" target="_blank" rel="noreferrer" className="block w-full text-center bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition">
                                Open Drive Folder ↗
                            </a>
                        </div>
                    )}

                </main>
            </div>

            {/* Task Submission Modal - Fixed Overlay */}
            {submitModal && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all scale-100 font-sans">
                        <div className="p-6 border-b flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-800">Submit Task Proof</h3>
                            <button onClick={() => setSubmitModal(null)} className="text-gray-400 hover:text-red-500 text-3xl">&times;</button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleTaskSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Task</label>
                                    <input type="text" value={submitModal.title} readOnly className="w-full px-4 py-2 bg-gray-100 border rounded-lg text-gray-500 text-sm font-medium" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Upload Proof (Screenshot/PDF)</label>
                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center hover:bg-gray-50 transition cursor-pointer relative">
                                        <input 
                                            type="file" 
                                            required 
                                            onChange={e => setReportFile(e.target.files?.[0] || null)}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                                        />
                                        <svg className="mx-auto h-12 w-12 text-gray-300" stroke="currentColor" fill="none" viewBox="0 0 48 48"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                                        <p className="mt-2 text-sm text-gray-600 font-medium">
                                            {reportFile ? <span className="text-green-600">✓ {reportFile.name}</span> : 'Click to select file' }
                                        </p>
                                    </div>
                                </div>
                                <div className="pt-2">
                                    <button 
                                        type="submit" 
                                        disabled={submitting}
                                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow disabled:opacity-50"
                                    >
                                        {submitting ? 'Uploading Proof...' : 'Submit Report'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default CampusAmbassador;
