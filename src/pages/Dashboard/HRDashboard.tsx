import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

type Tab = 'applicants' | 'submissions' | 'tasks' | 'withdrawals' | 'interns';

interface Task { id: string; title: string; description: string; default_points: number; }
interface Applicant { id: string; name: string; email: string; phone: string; college: string; year: string; reason_ca: string; resume_url: string; ca_record_id: string | null; status: string; created_at: string; }
interface Submission { id: string; ca_id: string; report_url: string; submitted_at: string; status: string; task: { title: string; default_points: number } | null; }
interface Withdrawal { id: string; ca_id: string; amount_inr: number; amount_points: number; status: string; created_at: string; ca: { student: { name: string; email: string; mobile: string } | null } | null; }
interface Intern { id: string; name: string; email: string; phone: string; college: string; branch: string; year: string; tech_stack: string[]; resume_url: string; created_at: string; }

const HRDashboard: React.FC = () => {
  const { profile, loading, signOut } = useAuth();
  const [authorized, setAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('applicants');
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [interns, setInterns] = useState<Intern[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [currentTask, setCurrentTask] = useState<Partial<Task>>({});

  useEffect(() => {
    if (!loading) checkHRAuth();
  }, [loading]);

  const checkHRAuth = async () => {
    const { data, error } = await supabase.rpc('is_hr_or_admin');
    if (error || !data) {
      alert('Unauthorized access.');
      window.location.href = '/login.html';
      return;
    }
    setAuthorized(true);
    loadData('applicants');
  };

  const loadData = (tab: Tab) => {
    setActiveTab(tab);
    switch (tab) {
      case 'applicants': loadApplicants(); break;
      case 'submissions': loadSubmissions(); break;
      case 'tasks': loadTasks(); break;
      case 'withdrawals': loadWithdrawals(); break;
      case 'interns': loadInterns(); break;
    }
  };

  const loadApplicants = async () => {
    const [{ data: apps }, { data: statusRecs }] = await Promise.all([
      supabase.from('ca_hire').select('*').order('created_at', { ascending: false }),
      supabase.from('campus_ambassadors').select('id, student_id, status'),
    ]);
    const merged = (apps || []).map(app => {
      const rec = (statusRecs || []).find(r => r.student_id === app.student_id);
      return { ...app, ca_record_id: rec?.id || null, status: rec?.status || 'unknown' };
    });
    setApplicants(merged);
  };

  const loadSubmissions = async () => {
    const { data } = await supabase.from('ca_submissions')
      .select('*, task:ca_tasks(title, default_points)')
      .eq('status', 'pending').order('submitted_at', { ascending: false });
    setSubmissions(data || []);
  };

  const loadTasks = async () => {
    const { data } = await supabase.from('ca_tasks').select('*').order('created_at', { ascending: false });
    setTasks(data || []);
  };

  const loadWithdrawals = async () => {
    const { data } = await supabase.from('withdrawals')
      .select('*, ca:campus_ambassadors(id, student:students(name, email, mobile))')
      .order('created_at', { ascending: false });
    setWithdrawals(data || []);
  };

  const loadInterns = async () => {
    const { data } = await supabase.from('intern_hire').select('*').order('created_at', { ascending: false });
    setInterns(data || []);
  };

  const handleUpdateStatus = async (caRecordId: string, status: string) => {
    if (!confirm(`Mark applicant as ${status.toUpperCase()}?`)) return;
    await supabase.from('campus_ambassadors').update({ status }).eq('id', caRecordId);
    loadApplicants();
  };

  const handleReviewTask = async (subId: string, caId: string, status: string, points: number) => {
    await supabase.from('ca_submissions').update({ status, points_awarded: status === 'approved' ? points : 0 }).eq('id', subId);
    if (status === 'approved') {
      const { data: ca } = await supabase.from('campus_ambassadors').select('total_points').eq('id', caId).single();
      if (ca) await supabase.from('campus_ambassadors').update({ total_points: (ca.total_points || 0) + points }).eq('id', caId);
    }
    loadSubmissions();
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    await supabase.from('ca_tasks').delete().eq('id', id);
    loadTasks();
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentTask.id) {
      await supabase.from('ca_tasks').update({
        title: currentTask.title,
        description: currentTask.description,
        default_points: currentTask.default_points
      }).eq('id', currentTask.id);
    } else {
      await supabase.from('ca_tasks').insert({
        title: currentTask.title,
        description: currentTask.description,
        default_points: currentTask.default_points
      });
    }
    setShowTaskModal(false);
    loadTasks();
  };

  const processWithdrawal = async (id: string, status: string, caId: string, points: number) => {
    if (!confirm(`Mark as ${status.toUpperCase()}?`)) return;
    await supabase.from('withdrawals').update({ status }).eq('id', id);
    if (status === 'rejected' && caId && points) {
      const { data: ca } = await supabase.from('campus_ambassadors').select('total_points').eq('id', caId).single();
      if (ca) await supabase.from('campus_ambassadors').update({ total_points: ca.total_points + points }).eq('id', caId);
    }
    loadWithdrawals();
  };

  if (loading || !authorized) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100 font-sans">Verifying authorization...</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 font-sans text-gray-800">

      {/* Sidebar - Matching Legacy Layout */}
      <aside className="w-64 bg-gray-900 text-white flex-shrink-0 hidden md:flex flex-col">
        <div className="p-6 text-xl font-bold border-b border-gray-700 flex items-center">
          <span className="text-blue-400 mr-2">●</span> Mealiez HR
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <p className="px-4 text-[10px] font-black text-gray-400 uppercase mt-4 mb-2 tracking-widest">Management</p>

          <button onClick={() => loadData('applicants')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center transition font-bold ${activeTab === 'applicants' ? 'bg-blue-600 shadow-md' : 'hover:bg-gray-800'}`}>
            <i className="fas fa-users w-6 text-center mr-3 text-blue-400"></i>
            CA Applicants
          </button>

          <button onClick={() => loadData('submissions')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center transition font-bold ${activeTab === 'submissions' ? 'bg-blue-600 shadow-md' : 'hover:bg-gray-800'}`}>
            <i className="fas fa-tasks w-6 text-center mr-3 text-blue-400"></i>
            Task Reviews
          </button>

          <button onClick={() => loadData('tasks')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center transition font-bold ${activeTab === 'tasks' ? 'bg-blue-600 shadow-md' : 'hover:bg-gray-800'}`}>
            <i className="fas fa-list-check w-6 text-center mr-3 text-blue-400"></i>
            Manage Tasks
          </button>

          <p className="px-4 text-[10px] font-black text-gray-400 uppercase mt-8 mb-2 tracking-widest">Finance & Hiring</p>

          <button onClick={() => loadData('withdrawals')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center transition font-bold ${activeTab === 'withdrawals' ? 'bg-blue-600 shadow-md' : 'hover:bg-gray-800'}`}>
            <i className="fas fa-money-bill-transfer w-6 text-center mr-3 text-blue-400"></i>
            Withdrawal Requests
          </button>

          <button onClick={() => loadData('interns')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center transition font-bold ${activeTab === 'interns' ? 'bg-blue-600 shadow-md' : 'hover:bg-gray-800'}`}>
            <i className="fas fa-briefcase w-6 text-center mr-3 text-blue-400"></i>
            Intern Applicants
          </button>
        </nav>
        <div className="p-4 border-t border-gray-800">
          <button onClick={signOut} className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition flex justify-center items-center font-bold">
            <i className="fas fa-sign-out-alt mr-2"></i>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8 bg-gray-50">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 capitalize">{activeTab.replace(/([A-Z])/g, ' $1').trim()} Management</h1>
          <div className="text-sm text-gray-500 font-medium">HR Portal: {profile?.full_name}</div>
        </header>

        {/* Applicants Section */}
        {activeTab === 'applicants' && (
          <div className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto">
            <table className="w-full whitespace-nowrap">
              <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="p-4">Candidate Profile</th>
                  <th className="p-4">Education</th>
                  <th className="p-4">The Pitch</th>
                  <th className="p-4">Resume</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {applicants.map(app => (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <div className="font-bold text-gray-900">{app.name}</div>
                      <div className="text-xs text-blue-600">{app.email}</div>
                      <div className="text-xs text-gray-500">{app.phone}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-medium">{app.college}</div>
                      <div className="text-xs text-gray-500">{app.year}</div>
                    </td>
                    <td className="p-4 max-w-xs overflow-hidden">
                      <div className="text-xs text-gray-600 italic">"{app.reason_ca?.substring(0, 100)}..."</div>
                    </td>
                    <td className="p-4">
                      <a href={app.resume_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-bold text-xs uppercase">View Resume</a>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${app.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {app.status}
                      </span>
                    </td>
                    <td className="p-4">
                      {app.status === 'pending' && app.ca_record_id ? (
                        <div className="flex space-x-2">
                          <button onClick={() => handleUpdateStatus(app.ca_record_id!, 'approved')} className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-700">Approve</button>
                          <button onClick={() => handleUpdateStatus(app.ca_record_id!, 'rejected')} className="bg-red-500 text-white px-3 py-1 rounded text-xs font-bold hover:bg-red-600">Reject</button>
                        </div>
                      ) : <span className="text-gray-400 text-xs">Closed</span>}
                    </td>
                  </tr>
                ))}
                {applicants.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-500">No applicants found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* Task Reviews Section */}
        {activeTab === 'submissions' && (
          <div className="grid gap-6">
            {submissions.map(sub => (
              <div key={sub.id} className="bg-white p-6 rounded-lg shadow border border-gray-100 flex flex-col md:flex-row justify-between items-start gap-4">
                <div>
                  <h4 className="font-bold text-lg text-gray-800">{sub.task?.title || 'Unknown Task'}</h4>
                  <p className="text-xs text-gray-400 mt-1">Submitted: {new Date(sub.submitted_at).toLocaleString()}</p>
                  <a href={sub.report_url} target="_blank" rel="noreferrer" className="text-blue-600 underline text-sm mt-3 inline-block font-bold">View Report Proof 📎</a>
                </div>
                <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-gray-500">Points:</label>
                    <input type="number" id={`pts-${sub.id}`} defaultValue={sub.task?.default_points || 0} className="w-20 border rounded px-2 py-1 text-right font-bold" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleReviewTask(sub.id, sub.ca_id, 'approved', parseInt((document.getElementById(`pts-${sub.id}`) as HTMLInputElement)?.value || '0'))} className="bg-green-600 text-white px-4 py-1 rounded text-sm font-bold hover:bg-green-700">Approve</button>
                    <button onClick={() => handleReviewTask(sub.id, sub.ca_id, 'rejected', 0)} className="bg-red-500 text-white px-4 py-1 rounded text-sm font-bold hover:bg-red-600">Reject</button>
                  </div>
                </div>
              </div>
            ))}
            {submissions.length === 0 && <div className="p-8 bg-white rounded-lg text-center text-gray-500 shadow">No pending reviews found.</div>}
          </div>
        )}

        {/* Manage Tasks Section */}
        {activeTab === 'tasks' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">Campus Ambassador Tasks</h3>
              <button
                onClick={() => { setCurrentTask({}); setShowTaskModal(true); }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center shadow transition font-bold"
              >
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                Add New Task
              </button>
            </div>
            <div className="overflow-hidden border border-gray-200 rounded-lg">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                  <tr>
                    <th className="p-4">Task Title & Description</th>
                    <th className="p-4 w-32 text-center">Points</th>
                    <th className="p-4 w-32 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {tasks.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <div className="font-bold text-gray-800">{t.title}</div>
                        <div className="text-gray-500 mt-1">{t.description}</div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-bold">{t.default_points}</span>
                      </td>
                      <td className="p-4 text-center ">
                        <button onClick={() => { setCurrentTask(t); setShowTaskModal(true); }} className="text-blue-600 hover:underline mr-3 font-bold">Edit</button>
                        <button onClick={() => handleDeleteTask(t.id)} className="text-red-500 hover:underline font-bold">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Withdrawal Section */}
        {activeTab === 'withdrawals' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-lg">Payout Requests</h3>
              <button onClick={loadWithdrawals} className="text-blue-600 text-sm hover:underline font-bold">Refresh List</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-left">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Ambassador</th>
                    <th className="p-4">Contact</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Requested On</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {withdrawals.map(req => (
                    <tr key={req.id}>
                      <td className="p-4 font-bold">{req.ca?.student?.name || 'Unknown'}</td>
                      <td className="p-4 text-xs font-medium">
                        <div>{req.ca?.student?.email}</div>
                        <div className="text-gray-500 mt-1">{req.ca?.student?.mobile}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-purple-700">₹{req.amount_inr}</div>
                        <div className="text-[10px] text-gray-400 font-bold">{req.amount_points} Pts</div>
                      </td>
                      <td className="p-4 text-gray-500">{new Date(req.created_at).toLocaleDateString()}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${req.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="p-4">
                        {req.status === 'pending' ? (
                          <button
                            onClick={() => processWithdrawal(req.id, 'approved', req.ca_id, req.amount_points)}
                            className="bg-purple-600 text-white px-4 py-1 rounded text-xs font-bold hover:bg-purple-700"
                          >
                            Mark Paid
                          </button>
                        ) : <span className="text-gray-400 font-medium">Processed</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Interns Section */}
        {activeTab === 'interns' && (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full whitespace-nowrap">
              <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="p-4">Candidate</th>
                  <th className="p-4">Role & Tech</th>
                  <th className="p-4">Education</th>
                  <th className="p-4">Resume</th>
                  <th className="p-4">Applied On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {interns.map(intern => (
                  <tr key={intern.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <div className="font-bold">{intern.name}</div>
                      <div className="text-xs text-blue-600 font-medium">{intern.email}</div>
                      <div className="text-xs text-gray-400 mt-1">{intern.phone}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-gray-800 text-sm mb-1">{intern.tech_stack?.find(t => t.startsWith('Role:'))?.replace('Role: ', '') || 'Unknown'}</div>
                      <div className="flex gap-1 flex-wrap">
                        {intern.tech_stack?.filter(t => !t.startsWith('Role:')).map(t => (
                          <span key={t} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-medium">{intern.college}</div>
                      <div className="text-xs text-gray-500">{intern.branch} • {intern.year}</div>
                    </td>
                    <td className="p-4">
                      <a href={intern.resume_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-bold text-sm">Download</a>
                    </td>
                    <td className="p-4 text-xs font-medium text-gray-400">{new Date(intern.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </main>

      {/* Task Modal Overlay */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all scale-100">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">{currentTask.id ? 'Edit Task' : 'Add New Task'}</h3>
              <button onClick={() => setShowTaskModal(false)} className="text-gray-400 hover:text-red-500 text-2xl font-bold">&times;</button>
            </div>
            <div className="p-6">
              <form onSubmit={handleSaveTask} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Task Title</label>
                  <input
                    type="text"
                    required
                    value={currentTask.title || ''}
                    onChange={e => setCurrentTask({ ...currentTask, title: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Share Reel on Story"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={currentTask.description || ''}
                    onChange={e => setCurrentTask({ ...currentTask, description: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Instructions..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Points Reward</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={currentTask.default_points || ''}
                    onChange={e => setCurrentTask({ ...currentTask, default_points: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 50"
                  />
                </div>
                <div className="pt-2">
                  <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition">
                    Save Task
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

export default HRDashboard;
