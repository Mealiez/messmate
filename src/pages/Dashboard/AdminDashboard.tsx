import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  UserCheck, 
  CreditCard, 
  Utensils, 
  Settings, 
  QrCode, 
  BarChart2, 
  LogOut, 
  Menu, 
  X,
  FileText,
  Clock,
  Plus
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

type Section = 'dashboard' | 'students' | 'attendance' | 'payments' | 'menu' | 'plans' | 'messInfo' | 'scan';

const AdminDashboard: React.FC = () => {
  const { user, profile, loading, signOut } = useAuth('admin');
  const [activeSection, setActiveSection] = useState<Section>('dashboard');
  const [students, setStudents] = useState<any[]>([]);
  const [scanResult, setScanResult] = useState<string>('');
  const [messInfo, setMessInfo] = useState<any>({ name: '', email: '', phone: '', college: '', location: '' });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (user) {
      loadAdminData();
    }
  }, [user]);

  // Handle QR Scanner Lifecycle
  useEffect(() => {
    if (activeSection === 'scan') {
      if (!scannerRef.current) {
        scannerRef.current = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250 }, false);
        scannerRef.current.render(
          (decodedText) => {
            setScanResult(`Scanned ID: ${decodedText}`);
            // Logic to mark attendance via Supabase would go here
            markAttendance(decodedText);
          },
          (error) => {
            // ignore scan errors (they happen every frame that fails to detect a qr code)
          }
        );
      }
    } else {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => console.error("Failed to clear scanner", e));
        scannerRef.current = null;
      }
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => console.error(e));
        scannerRef.current = null;
      }
    }
  }, [activeSection]);

  const loadAdminData = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('mess_id', user!.id);
      if (error) throw error;
      setStudents(data || []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
  };

  const markAttendance = async (studentId: string) => {
    try {
      setScanResult(`Marking attendance for ${studentId}...`);
      const today = new Date().toISOString().split('T')[0];
      
      // Check if already marked for today
      const { data: existing } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', studentId)
        .eq('date', today)
        .maybeSingle();

      if (existing) {
        setScanResult(`Already marked present for today: ${studentId}`);
        return;
      }

      const { error } = await supabase.from('attendance').insert({
        student_id: studentId,
        date: today,
        status: 'PRESENT',
        marked_at: new Date().toISOString()
      });

      if (error) throw error;
      setScanResult(`Successfully marked present: ${studentId}`);
      // Refresh counts
      loadAdminData();
    } catch (e: any) {
      console.error(e);
      setScanResult(`Error: ${e.message || 'Failed to mark attendance'}`);
    }
  };

  const attendanceChartRef = useRef<HTMLCanvasElement>(null);
  const paymentChartRef = useRef<HTMLCanvasElement>(null);
  const attChartInstance = useRef<Chart | null>(null);
  const payChartInstance = useRef<Chart | null>(null);

  // Handle Charts Lifecycle
  useEffect(() => {
    if (activeSection === 'dashboard' && students.length >= 0) {
      if (attChartInstance.current) attChartInstance.current.destroy();
      if (payChartInstance.current) payChartInstance.current.destroy();

      if (attendanceChartRef.current) {
        attChartInstance.current = new Chart(attendanceChartRef.current, {
          type: 'line',
          data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
              label: 'Attendance',
              data: [12, 19, 3, 5, 2, 3, 10],
              borderColor: 'rgb(37, 99, 235)',
              tension: 0.1
            }]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }

      if (paymentChartRef.current) {
        payChartInstance.current = new Chart(paymentChartRef.current, {
          type: 'doughnut',
          data: {
            labels: ['Paid', 'Pending'],
            datasets: [{
              data: [300, 50],
              backgroundColor: ['rgb(34, 197, 94)', 'rgb(239, 68, 68)']
            }]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }
    }

    return () => {
      if (attChartInstance.current) attChartInstance.current.destroy();
      if (payChartInstance.current) payChartInstance.current.destroy();
    };
  }, [activeSection, students]);

  const copyMessId = () => {
    if (user) {
      navigator.clipboard.writeText(user.id);
      alert('Mess ID copied to clipboard!');
    }
  };

  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">Loading Dashboard...</div>;
  }

  const navigateTo = (section: Section, e: React.MouseEvent) => {
    e.preventDefault();
    setActiveSection(section);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 font-sans text-gray-800">
      {/* Sidebar Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black opacity-50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`bg-gray-900 text-white w-64 fixed inset-y-0 left-0 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out z-30 md:relative md:translate-x-0 md:flex-shrink-0 flex flex-col`}>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center mb-8">
            <img src="/assets/logo.png" alt="Mealiez Logo" className="h-8 w-8" />
            <span className="ml-2 text-xl font-bold">Mealiez Admin</span>
          </div>

          <nav className="space-y-2">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'students', label: 'Students', icon: Users },
              { id: 'attendance', label: 'Attendance', icon: UserCheck },
              { id: 'payments', label: 'Payments', icon: CreditCard },
              { id: 'menu', label: 'Menu', icon: Utensils },
              { id: 'plans', label: 'Plans', icon: FileText },
              { id: 'messInfo', label: 'Mess Info', icon: Settings },
              { id: 'scan', label: 'Scan QR', icon: QrCode }
            ].map(item => (
              <a 
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => navigateTo(item.id as Section, e)}
                className={`flex items-center px-4 py-3 rounded-lg transition ${activeSection === item.id ? 'bg-blue-600 shadow-md' : 'hover:bg-gray-800'}`}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.label}
              </a>
            ))}
            
            <a href="/report.html" className="flex items-center px-4 py-3 rounded-lg hover:bg-gray-800 transition">
              <BarChart2 className="w-5 h-5 mr-3" />
              Reports
            </a>
          </nav>
        </div>

        <div className="p-6 border-t border-gray-800">
          <button onClick={signOut} className="w-full flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
            <LogOut className="h-5 w-5 mr-2" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center">
              <button onClick={() => setSidebarOpen(true)} className="md:hidden mr-4 text-gray-600 hover:text-gray-900">
                <Menu className="h-6 w-6" />
              </button>
              <h1 className="text-2xl font-bold text-gray-800 capitalize">{activeSection.replace(/([A-Z])/g, ' $1').trim()}</h1>
            </div>
            <div className="flex items-center">
              <span className="text-gray-600 mr-2">Admin</span>
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : 'A'}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
          
          {/* Dashboard Section */}
          {activeSection === 'dashboard' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Status Cards */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center">
                    <i className="fas fa-user-graduate text-3xl text-blue-600 mr-4"></i>
                    <div>
                      <p className="text-gray-500 text-sm">Total Students</p>
                      <p className="text-2xl font-bold">{students.length}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center">
                    <i className="fas fa-indian-rupee-sign text-3xl text-green-600 mr-4"></i>
                    <div>
                      <p className="text-gray-500 text-sm">Monthly Revenue</p>
                      <p className="text-2xl font-bold">₹0</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center">
                    <i className="fas fa-clipboard-check text-3xl text-yellow-600 mr-4"></i>
                    <div>
                      <p className="text-gray-500 text-sm">Attendance Rate</p>
                      <p className="text-2xl font-bold">0%</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center">
                    <i className="fas fa-exclamation-circle text-3xl text-red-600 mr-4"></i>
                    <div>
                      <p className="text-gray-500 text-sm">Pending Payments</p>
                      <p className="text-2xl font-bold">0</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mess ID Card */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center">
                  <i className="fas fa-fingerprint text-3xl text-purple-600 mr-4"></i>
                  <div className="flex-1">
                    <p className="text-gray-500 text-sm">Your Mess ID (Share with Students)</p>
                    <div className="flex items-center mt-1">
                      <p className="text-lg font-mono font-bold mr-2 bg-gray-100 px-3 py-1 rounded">{user?.id}</p>
                      <button onClick={copyMessId} title="Copy Mess ID" className="text-blue-600 hover:text-blue-800 p-2">
                        <i className="fas fa-copy"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">
                    <i className="fas fa-chart-line mr-2 text-blue-600"></i>
                    Attendance Trend (Last 7 Days)
                  </h3>
                  <div className="h-64">
                    <canvas ref={attendanceChartRef}></canvas>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">
                    <i className="fas fa-chart-pie mr-2 text-green-600"></i>
                    Payment Breakdown
                  </h3>
                  <div className="h-64">
                    <canvas ref={paymentChartRef}></canvas>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Students Section */}
          {activeSection === 'students' && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Student Management</h2>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">Add Student</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {students.map(s => (
                      <tr key={s.id}>
                        <td className="px-4 py-4">{s.name}</td>
                        <td className="px-4 py-4">{s.email}</td>
                        <td className="px-4 py-4">
                           <span className={`px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800`}>Active</span>
                        </td>
                        <td className="px-4 py-4 text-blue-600 hover:underline cursor-pointer">Edit</td>
                      </tr>
                    ))}
                    {students.length === 0 && <tr><td colSpan={4} className="px-4 py-4 text-center text-gray-500">No students found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Attendance Section */}
          {activeSection === 'attendance' && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Attendance Records</h2>
              <div className="mb-4 text-right">
                <button className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition">
                  Mark Absentees for Previous Meal
                </button>
              </div>
              <p className="text-center text-gray-500 py-10">Attendance records will appear here.</p>
            </div>
          )}

          {/* Payments Section */}
          {activeSection === 'payments' && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Payment Management</h2>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">Add Payment</button>
              </div>
              <p className="text-center text-gray-500 py-10">Payment logs will appear here.</p>
            </div>
          )}

          {/* Menu Section */}
          {activeSection === 'menu' && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Menu Management</h2>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">Add Menu</button>
              </div>
              <p className="text-center text-gray-500 py-10">Menu setup will appear here.</p>
            </div>
          )}

          {/* Plans Section */}
          {activeSection === 'plans' && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Plan Management</h2>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">Add Plan</button>
              </div>
              <p className="text-center text-gray-500 py-10">Meal plans will appear here.</p>
            </div>
          )}

          {/* Mess Info Section */}
          {activeSection === 'messInfo' && (
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Edit Mess Information</h2>
              <form className="space-y-4" onSubmit={e => e.preventDefault()}>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Mess Name</label>
                  <input type="text" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Contact Email</label>
                  <input type="email" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Contact Phone</label>
                  <input type="tel" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition shadow">
                  Save Changes
                </button>
              </form>
            </div>
          )}

          {/* Scan Section */}
          {activeSection === 'scan' && (
            <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col items-center">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Scan Student QR Code</h2>
              <div className="w-full max-w-sm border rounded-lg overflow-hidden relative min-h-[300px] bg-black">
                <div id="qr-reader" className="w-full"></div>
              </div>
              <div className="mt-4 text-center font-semibold text-lg text-blue-600 h-8">{scanResult}</div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
