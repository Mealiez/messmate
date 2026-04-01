import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

interface Student {
  id: string;
  name: string;
  email: string;
  mobile: string;
  room_no: string;
  plan_type: string;
  status: string;
  mess_id: string | null;
}

interface Attendance {
  id: string;
  student_id: string;
  date: string;
  status: string;
  marked_at: string;
  meal?: string;
}

interface Payment {
  id: string;
  amount: number;
  due_date: string;
  paid_on: string | null;
  status: string;
}

interface Menu {
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
}

interface ChildCardData {
  student: Student;
  attendance: Attendance[];
  payments: Payment[];
  menu: Menu | null;
}

function ChildCard({ data }: { data: ChildCardData }) {
  const { student, attendance, payments, menu } = data;
  const totalDays = attendance.length;
  const presentDays = attendance.filter(a => a.status.toUpperCase() === 'PRESENT').length;
  const attendanceRate = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : '0';
  const recentAttendance = attendance.slice(0, 5);

  return (
    <div className="bg-white rounded-lg shadow-md p-8 mb-8 border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">{student.name}</h2>
          <p className="text-gray-600 font-medium">Room {student.room_no || 'N/A'} • {student.plan_type || 'No Plan'}</p>
          <p className="text-sm text-gray-500 mt-1">{student.email} • {student.mobile}</p>
        </div>
        <span className={`px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider ${student.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {student.status || 'Unknown'}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-blue-50 rounded-lg p-6 border border-blue-100">
          <p className="text-xs text-blue-600 mb-1 font-black uppercase tracking-widest">Attendance Rate</p>
          <p className="text-4xl font-black text-gray-900">{attendanceRate}%</p>
          <p className="text-xs text-gray-500 mt-2 font-bold">{presentDays} of {totalDays} records</p>
        </div>
        <div className="bg-green-50 rounded-lg p-6 border border-green-100">
          <p className="text-xs text-green-600 mb-1 font-black uppercase tracking-widest">Contact Details</p>
          <p className="text-lg font-bold text-gray-800 mt-2">{student.email}</p>
          <p className="text-sm text-gray-600 font-medium">{student.mobile}</p>
        </div>
      </div>

      {/* Attendance & Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex items-center">
            <i className="fas fa-calendar-check mr-2 text-blue-600"></i>
            Recent Attendance
          </h3>
          <div className="space-y-3 mt-4">
            {recentAttendance.length > 0 ? recentAttendance.map((record, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <p className="font-bold text-gray-800">{new Date(record.date).toLocaleDateString()}</p>
                  {record.meal && <p className="text-xs text-gray-500 font-black italic uppercase tracking-tighter">{record.meal}</p>}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${record.status.toUpperCase() === 'PRESENT' ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
                  {record.status}
                </span>
              </div>
            )) : <p className="text-gray-500 text-center py-6 italic font-medium bg-gray-50 rounded-lg">No records found</p>}
          </div>
        </div>

        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
             <h3 className="text-lg font-bold text-gray-800 flex items-center">
               <i className="fas fa-history mr-2 text-purple-600"></i>
               Payment History
             </h3>
             <button className="text-blue-600 hover:underline text-xs font-bold uppercase tracking-widest">Receipts</button>
          </div>
          <div className="space-y-3 mt-4">
            {payments && payments.length > 0 ? payments.map((payment, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <p className="font-black text-gray-900 text-xl">₹{payment.amount}</p>
                  <p className="text-xs text-gray-500 font-bold mt-1 uppercase tracking-tighter">Due: {new Date(payment.due_date).toLocaleDateString()}</p>
                </div>
                <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${payment.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {payment.status}
                </span>
              </div>
            )) : <p className="text-gray-500 text-center py-6 italic font-medium bg-gray-50 rounded-lg">No records found</p>}
          </div>
        </div>
      </div>

      {/* Today's Menu */}
      <div className="bg-white border rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
            <i className="fas fa-utensils mr-2 text-orange-500"></i>
            Today's Menu Overview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="bg-orange-50 rounded-lg p-5 border border-orange-100">
            <h4 className="font-black text-orange-800 mb-2 uppercase text-xs tracking-widest">Breakfast</h4>
            <p className="text-gray-700 font-bold italic mt-2">"{menu?.breakfast || "Not available"}"</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-5 border border-yellow-100">
            <h4 className="font-black text-yellow-800 mb-2 uppercase text-xs tracking-widest">Lunch</h4>
            <p className="text-gray-700 font-bold italic mt-2">"{menu?.lunch || "Not available"}"</p>
          </div>
           <div className="bg-blue-50 rounded-lg p-5 border border-blue-100">
            <h4 className="font-black text-blue-800 mb-2 uppercase text-xs tracking-widest">Dinner</h4>
            <p className="text-gray-700 font-bold italic mt-2">"{menu?.dinner || "Not available"}"</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const ParentDashboard: React.FC = () => {
  const { user, profile, loading, signOut } = useAuth('parent');
  const [children, setChildren] = useState<ChildCardData[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (user) loadChildren();
  }, [user]);

  const loadChildren = async () => {
    setDataLoading(true);
    try {
      const { data: students } = await supabase
        .from('students')
        .select('*')
        .eq('parent_id', user!.id);

      if (!students || students.length === 0) {
        setChildren([]);
        setDataLoading(false);
        return;
      }

      const today = new Date().toISOString().split('T')[0];

      const childData = await Promise.all(students.map(async (student) => {
        const [{ data: attendance }, { data: payments }, { data: menu }] = await Promise.all([
          supabase.from('attendance').select('*').eq('student_id', student.id).order('date', { ascending: false }),
          supabase.from('payments').select('*').eq('student_id', student.id).order('due_date', { ascending: false }).limit(3),
          supabase.from('menu').select('*').eq('date', today).maybeSingle(),
        ]);
        return { student, attendance: attendance || [], payments: payments || [], menu };
      }));

      setChildren(childData);
    } catch (err) {
      console.error('Failed to load children:', err);
    } finally {
      setDataLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100 italic font-bold">Loading Dashboard...</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 font-sans text-gray-800">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-900 text-white flex-shrink-0 hidden md:flex flex-col">
            <div className="p-6 text-xl font-bold border-b border-gray-700 flex items-center">
                <img src="/assets/logo.png" alt="Mealiez" className="h-8 w-8 mr-2" />
                Mealiez Parent
            </div>
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                <a href="#dashboard" className="flex items-center px-4 py-3 bg-blue-600 rounded-lg font-bold shadow-md">
                    <i className="fas fa-th-large w-6 text-center mr-3"></i>
                    Dashboard
                </a>
            </nav>
            <div className="p-4 border-t border-gray-800">
                <button onClick={signOut} className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition font-bold flex items-center justify-center">
                    <i className="fas fa-sign-out-alt mr-2"></i>
                    Logout
                </button>
            </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
            <header className="bg-white shadow-sm border-b border-gray-100 px-8 py-4 flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Parent Dashboard</h1>
                <div className="text-sm text-gray-500 font-medium italic">Portal: {profile?.full_name}</div>
            </header>

            <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
                <div className="max-w-6xl mx-auto">
                    {/* Welcome Section */}
                    <div className="bg-blue-600 rounded-lg shadow-md p-8 text-white mb-8 border-b-4 border-blue-700">
                        <h2 className="text-2xl font-bold mb-1">Welcome Back!</h2>
                        <p className="text-blue-100 font-medium tracking-wide">Monitor your children's mess activities and payments.</p>
                    </div>

                    {/* No Students Message */}
                    {dataLoading ? (
                        <div className="text-center text-gray-500 py-20 bg-white rounded-lg border border-dashed border-gray-300">
                            <i className="fas fa-spinner fa-spin fa-3x mb-4 text-blue-500"></i>
                            <p className="text-xl font-black uppercase tracking-widest text-gray-400">Loading student data...</p>
                        </div>
                    ) : children.length === 0 ? (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 flex items-center shadow-sm">
                            <i className="fas fa-exclamation-triangle text-yellow-500 text-3xl mr-6"></i>
                            <div>
                                <p className="font-bold text-gray-800 text-lg">No students linked to your account</p>
                                <p className="text-gray-600 font-medium">Please contact the administrator to link your child's account to this email.</p>
                            </div>
                        </div>
                    ) : (
                        /* Students Container */
                        <div className="space-y-8 animate-in fade-in duration-500">
                            {children.map((data) => <ChildCard key={data.student.id} data={data} />)}
                        </div>
                    )}
                </div>
            </main>
        </div>
    </div>
  );
};

export default ParentDashboard;
