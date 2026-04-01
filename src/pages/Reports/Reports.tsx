import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Download, 
    Calendar, 
    Filter, 
    ArrowLeft, 
    TrendingUp, 
    Users, 
    IndianRupee, 
    CheckCircle,
    ChevronDown,
    FileText,
    LogOut,
    Menu,
    X,
    BarChart2,
    PieChart
} from 'lucide-react';
// @ts-ignore
import { Chart, registerables } from 'chart.js';
// @ts-ignore
import { jsPDF } from 'jspdf';
// @ts-ignore
import 'jspdf-autotable';

Chart.register(...registerables);

const Reports: React.FC = () => {
    const { profile, loading, signOut } = useAuth();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [planType, setPlanType] = useState('');
    const [stats, setStats] = useState({ totalStudents: 0, totalRevenue: 0, avgAttendance: 0, pendingAmount: 0 });
    const [generating, setGenerating] = useState(false);
    
    const attendanceChartRef = useRef<HTMLCanvasElement>(null);
    const revenueChartRef = useRef<HTMLCanvasElement>(null);
    const attendanceChartInstance = useRef<any>(null);
    const revenueChartInstance = useRef<any>(null);

    useEffect(() => {
        if (!loading && profile) {
            // Initial load or defaults
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const lastDay = now.toISOString().split('T')[0];
            setStartDate(firstDay);
            setEndDate(lastDay);
        }
    }, [loading, profile]);

    const generateReport = async () => {
        if (!profile?.mess_id) return;
        setGenerating(true);

        try {
            // Fetch Students
            const { data: students } = await supabase.from('students').select('*').eq('mess_id', profile.mess_id);
            const totalStudents = students?.length || 0;

            // Fetch Payments
            let paymentQuery = supabase.from('payments').select('*').eq('mess_id', profile.mess_id);
            if (startDate) paymentQuery = paymentQuery.gte('payment_date', startDate);
            if (endDate) paymentQuery = paymentQuery.lte('payment_date', endDate);
            
            const { data: payments } = await paymentQuery;
            const totalRevenue = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
            const pendingAmount = (payments || []).filter(p => p.status === 'pending').reduce((sum, p) => sum + (p.amount || 0), 0);

            // Fetch Attendance
            let attendanceQuery = supabase.from('attendance').select('*').eq('mess_id', profile.mess_id);
            if (startDate) attendanceQuery = attendanceQuery.gte('date', startDate);
            if (endDate) attendanceQuery = attendanceQuery.lte('date', endDate);
            const { data: attendance } = await attendanceQuery;

            // Calculate Avg Attendance
            let avgAttendance = 0;
            if (totalStudents > 0) {
                const totalPossible = totalStudents * 30; // Approximation
                avgAttendance = Math.round(((attendance?.length || 0) / (totalPossible || 1)) * 100);
            }

            setStats({ totalStudents, totalRevenue, avgAttendance, pendingAmount });
            updateCharts(attendance || [], payments || []);

        } catch (err) {
            console.error('Report Error:', err);
        } finally {
            setGenerating(false);
        }
    };

    const updateCharts = (attendance: any[], payments: any[]) => {
        // Attendance Trend
        if (attendanceChartInstance.current) attendanceChartInstance.current.destroy();
        if (attendanceChartRef.current) {
            const ctx = attendanceChartRef.current.getContext('2d');
            attendanceChartInstance.current = new Chart(ctx!, {
                type: 'line',
                data: {
                    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                    datasets: [{
                        label: 'Attendance Count',
                        data: [12, 19, 15, 22], // Dummy trend for now
                        borderColor: '#2563eb',
                        tension: 0.1
                    }]
                }
            });
        }

        // Revenue Breakdown
        if (revenueChartInstance.current) revenueChartInstance.current.destroy();
        if (revenueChartRef.current) {
            const ctx = revenueChartRef.current.getContext('2d');
            revenueChartInstance.current = new Chart(ctx!, {
                type: 'doughnut',
                data: {
                    labels: ['Paid', 'Pending'],
                    datasets: [{
                        data: [stats.totalRevenue - stats.pendingAmount, stats.pendingAmount],
                        backgroundColor: ['#10b981', '#ef4444']
                    }]
                }
            });
        }
    };

    const exportPDF = (type: 'attendance' | 'payments') => {
        const doc = new jsPDF();
        doc.text(`${type.toUpperCase()} REPORT - ${profile?.mess_name}`, 14, 15);
        doc.text(`Period: ${startDate} to ${endDate}`, 14, 22);
        
        // @ts-ignore
        doc.autoTable({
            head: [['Date', 'Description', 'Amount / Status']],
            body: [
                ['2024-03-01', 'Sample Row', 'Success'],
                ['2024-03-02', 'Sample Row', 'Success'],
            ],
            startY: 30
        });
        doc.save(`Mealiez_${type}_Report.pdf`);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

    return (
        <div className="bg-gray-100 min-h-screen font-sans text-gray-800">
            {/* Header */}
            <header className="bg-white shadow-sm border-b sticky top-0 z-10 font-bold">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center">
                        <button onClick={() => window.location.href = '/admin-dashboard.html'} className="mr-4 text-gray-400 hover:text-gray-900 transition">
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                        </button>
                        <div className="flex items-center text-blue-600">
                            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                            <span className="ml-2 text-xl font-extrabold text-gray-900">Reports & Analytics</span>
                        </div>
                    </div>
                    <button onClick={signOut} className="bg-red-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-red-700 transition shadow-sm">
                        Logout
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                
                {/* Filters */}
                <section className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-gray-100">
                    <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
                        Report Filters
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Start Date</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 font-medium" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">End Date</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 font-medium" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Plan Type</label>
                            <select value={planType} onChange={e => setPlanType(e.target.value)} className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 font-bold">
                                <option value="">All Plans</option>
                                <option value="Monthly">Monthly</option>
                                <option value="Weekly">Weekly</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button onClick={generateReport} disabled={generating} className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg font-extrabold hover:bg-blue-700 transition shadow disabled:opacity-50">
                                {generating ? 'Generating...' : 'Generate Report'}
                            </button>
                        </div>
                    </div>
                </section>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    {[
                        { label: 'Total Students', value: stats.totalStudents, icon: 'M12 4.354a4 4 0 110 5.292', color: 'blue' },
                        { label: 'Total Revenue', value: `₹${stats.totalRevenue}`, icon: 'M12 8c-1.657 0-3 .895-3 2', color: 'green' },
                        { label: 'Avg Attendance', value: `${stats.avgAttendance}%`, icon: 'M9 5H7a2 2 0 00-2 2v12', color: 'yellow' },
                        { label: 'Pending Amount', value: `₹${stats.pendingAmount}`, icon: 'M12 8v4m0 4h.01', color: 'red' }
                    ].map((s, idx) => (
                        <div key={idx} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex items-center">
                            <div className={`bg-${s.color}-100 p-3 rounded-xl mr-4`}>
                                <svg className={`h-8 w-8 text-${s.color}-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={s.icon}/></svg>
                            </div>
                            <div>
                                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">{s.label}</p>
                                <p className="text-2xl font-black text-gray-900">{s.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Visual Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-6">Attendance Trend</h3>
                        <div className="relative h-64">
                            <canvas ref={attendanceChartRef}></canvas>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-6">Revenue Breakdown</h3>
                        <div className="relative h-64 flex justify-center">
                            <canvas ref={revenueChartRef}></canvas>
                        </div>
                    </div>
                </div>

                {/* Export Options */}
                <section className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center md:text-left">
                    <h2 className="text-xl font-extrabold text-gray-900 mb-6">Export Insights</h2>
                    <div className="flex flex-wrap justify-center md:justify-start gap-4">
                        <button onClick={() => exportPDF('attendance')} className="bg-red-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-red-700 transition flex items-center shadow-lg">
                            <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                            Export Attendance PDF
                        </button>
                        <button onClick={() => exportPDF('payments')} className="bg-red-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-red-700 transition flex items-center shadow-lg">
                            <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                            Export Payments PDF
                        </button>
                    </div>
                </section>

            </main>
        </div>
    );
};

export default Reports;
