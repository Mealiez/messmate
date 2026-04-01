import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { motion } from 'framer-motion';
import { LogOut, User as UserIcon, Calendar, FileText, CheckCircle, Clock } from 'lucide-react';

const StudentDashboard: React.FC = () => {
    const { user, profile, loading, signOut } = useAuth('student');
    const [student, setStudent] = useState<any>(null);
    const [messName, setMessName] = useState('Loading...');
    const [attendanceStats, setAttendanceStats] = useState({ percentage: 0, daysPresent: 0 });
    const [recentAttendance, setRecentAttendance] = useState<any[]>([]);

    useEffect(() => {
        if (user) {
            loadStudentData();
        }
    }, [user]);

    const loadStudentData = async () => {
        try {
            const { data: studentData, error } = await supabase
                .from('students')
                .select('*')
                .eq('user_id', user!.id)
                .maybeSingle();

            if (error) throw error;
            setStudent(studentData);

            if (studentData?.mess_id) {
                const { data: messAdmin } = await supabase
                    .from('user_profiles')
                    .select('full_name')
                    .eq('id', studentData.mess_id)
                    .single();

                if (messAdmin) setMessName(messAdmin.full_name);

                loadAttendance(studentData.id);
            } else {
                setMessName('Not Enrolled');
            }
        } catch (err) {
            console.error('Failed to load student tracking data:', err);
        }
    };

    const loadAttendance = async (studentId: string) => {
        const { data: attendance } = await supabase
            .from('attendance')
            .select('*')
            .eq('student_id', studentId)
            .order('marked_at', { ascending: false });

        if (attendance) {
            const totalRecords = attendance.length;
            const presentRecords = attendance.filter(a => a.status.toUpperCase() === 'PRESENT');

            const distinctDays = new Set(presentRecords.map(r => r.date)).size;
            const rate = totalRecords > 0 ? ((presentRecords.length / totalRecords) * 100).toFixed(1) : 0;

            setAttendanceStats({ percentage: Number(rate), daysPresent: distinctDays });
            setRecentAttendance(attendance.slice(0, 5));
        }
    };

    const handleMarkAttendance = async () => {
        // Basic logic for marking attendance based on time of day
        const hour = new Date().getHours();
        let meal = null;
        if (hour >= 7 && hour < 11) meal = 'BREAKFAST';
        else if (hour >= 12 && hour < 16) meal = 'LUNCH';
        else if (hour >= 19 && hour < 22) meal = 'DINNER';

        if (!meal) {
            alert('No meal service is currently active.');
            return;
        }

        if (!student?.mess_id) return;

        const today = new Date().toISOString().split('T')[0];
        try {
            const { error } = await supabase.from('attendance').insert({
                student_id: student.id,
                date: today,
                status: 'Present',
                meal: meal,
                mess_id: student.mess_id
            });

            if (error) {
                if (error.code === '23505') alert(`Attendance for ${meal} is already marked today.`);
                else throw error;
            } else {
                alert('Attendance marked successfully!');
                loadAttendance(student.id);
            }
        } catch (err: any) {
            alert('Error marking attendance: ' + err.message);
        }
    };

    if (loading || !profile) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50">Loading dashboard...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800">
            <nav className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <img src="/assets/logo.png" alt="Mealiez" className="h-8 w-8" />
                        <h1 className="text-xl font-bold text-gray-800">Mealiez</h1>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="hidden sm:flex items-center text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                            <UserIcon className="w-4 h-4 mr-2" />
                            <span className="text-sm font-medium">{profile.full_name}</span>
                        </div>
                        <button onClick={signOut} className="text-gray-500 hover:text-red-500 transition">
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <h2 className="text-2xl font-bold text-gray-800">Welcome, {profile.full_name}</h2>
                    <p className="text-gray-600">Mess: <span className="font-semibold text-blue-600">{messName}</span></p>
                </motion.div>

                {!student?.mess_id ? (
                    <div className="bg-white p-8 rounded-xl shadow text-center">
                        <h3 className="text-xl font-bold text-gray-800 mb-2">You are not enrolled in a mess</h3>
                        <p className="text-gray-600 mb-4">Please contact a mess owner to add you to their student list, or browse for local messes.</p>
                        <a href="/index.html#browse" className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold">Browse Messes</a>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">

                        {/* Daily Action Card */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-xl shadow-md p-6 border-t-4 border-blue-500"
                        >
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <Clock className="w-5 h-5 mr-2 text-blue-500" /> Daily Action
                            </h3>
                            <p className="text-sm text-gray-600 mb-4">Present yourself at the mess counter and tap the button below to log your daily meal.</p>
                            <button
                                onClick={handleMarkAttendance}
                                className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition shadow-md flex items-center justify-center gap-2"
                            >
                                <CheckCircle className="w-5 h-5" /> Mark Present
                            </button>
                        </motion.div>

                        {/* Stats Card */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 }}
                            className="bg-white rounded-xl shadow-md p-6 border-t-4 border-green-500"
                        >
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <Calendar className="w-5 h-5 mr-2 text-green-500" /> Attendance Stats
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-50 p-4 rounded-lg text-center">
                                    <p className="text-3xl font-bold text-green-600 mb-1">{attendanceStats.percentage}%</p>
                                    <p className="text-xs text-gray-600 font-medium">Monthly Rate</p>
                                </div>
                                <div className="bg-blue-50 p-4 rounded-lg text-center">
                                    <p className="text-3xl font-bold text-blue-600 mb-1">{attendanceStats.daysPresent}</p>
                                    <p className="text-xs text-gray-600 font-medium">Days Present</p>
                                </div>
                            </div>
                        </motion.div>

                        {/* Recent Activity Mini-feed */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 }}
                            className="bg-white rounded-xl shadow-md p-6 border-t-4 border-purple-500 lg:col-span-1 md:col-span-2 lg:col-start-auto"
                        >
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <FileText className="w-5 h-5 mr-2 text-purple-500" /> Recent Activity
                            </h3>
                            <div className="space-y-3">
                                {recentAttendance.length > 0 ? recentAttendance.map((record, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded border">
                                        <span className="text-sm font-medium">{new Date(record.date).toLocaleDateString()} - {record.meal}</span>
                                        <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">{record.status}</span>
                                    </div>
                                )) : (
                                    <p className="text-sm text-gray-500">No recent attendance found.</p>
                                )}
                            </div>
                        </motion.div>

                    </div>
                )}
            </main>
        </div>
    );
};

export default StudentDashboard;
