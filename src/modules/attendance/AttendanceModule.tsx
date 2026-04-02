import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { useTenantContext } from '../../core/context/TenantContext';
import { QrCode, CheckCircle, Smartphone } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  marked_at: string;
  students?: { name: string, room_no: string };
  meal: string;
}

export const AttendanceModule: React.FC = () => {
  const { tenantId, role, studentId } = useTenantContext();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (tenantId) fetchAttendance();
  }, [tenantId, filterDate]);

  const fetchAttendance = async () => {
    setLoading(true);
    let query = supabase
      .from('attendance')
      .select('*, students(name, room_no)')
      .eq('tenant_id', tenantId)
      .eq('date', filterDate)
      .order('marked_at', { ascending: false });

    // Students only see their own attendance logs
    if (role === 'student' && studentId) {
       query = query.eq('student_id', studentId);
    }

    const { data } = await query;
    setRecords(data || []);
    setLoading(false);
  };

  const markStudentPresent = async () => {
    if (!studentId || !tenantId) return;
    
    // Auto detect meal type based on current time (legacy logic from original code)
    const currentHour = new Date().getHours();
    let detectedMeal = null;
    if (currentHour >= 7 && currentHour < 11) detectedMeal = 'BREAKFAST';
    else if (currentHour >= 12 && currentHour < 16) detectedMeal = 'LUNCH';
    else if (currentHour >= 19 && currentHour < 22) detectedMeal = 'DINNER';

    if (!detectedMeal) {
      alert("No meal service is currently active at this time.");
      return;
    }

    setMarking(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      // Note: Added meal to the payload to support the meal check
      const { error } = await supabase.from('attendance').insert({
        student_id: studentId,
        tenant_id: tenantId,
        date: today,
        status: 'Present',
        meal: detectedMeal
      });

      if (error) {
        if (error.code === '23505') {
           alert(`Attendance for ${detectedMeal} is already marked today.`);
        } else {
           throw error;
        }
      } else {
        alert('Attendance marked successfully!');
        if (today === filterDate) {
          fetchAttendance(); // refresh if looking at today
        }
      }
    } catch (err: any) {
       alert("Error marking attendance: " + err.message);
    }
    setMarking(false);
  };

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 p-2 rounded-lg">
            <QrCode className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Smart Attendance</h3>
            <p className="text-sm text-gray-500">Track and manage attendance logs</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <input 
              type="date" 
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-green-500"
           />
        </div>
      </div>

      {role === 'student' && filterDate === new Date().toISOString().split('T')[0] && (
        <div className="p-6 bg-green-50 border-b border-green-100">
           <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h4 className="font-bold text-gray-800">Daily Action Required</h4>
                <p className="text-sm text-gray-600">Present yourself at the counter and tap to log your meal.</p>
              </div>
              <button 
                 onClick={markStudentPresent}
                 disabled={marking}
                 className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition shadow-md w-full md:w-auto justify-center font-bold disabled:opacity-50 disabled:shadow-none"
              >
                  <Smartphone className="w-5 h-5" />
                  {marking ? 'Marking...' : 'Tap To Mark Present'}
              </button>
           </div>
        </div>
      )}

      {role !== 'student' && (
         <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
            <p className="text-sm text-gray-600">Admin view currently shows records grouped by day. Future Feature: Launch QR Scanner.</p>
            <button className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100 transition shadow-sm text-sm font-medium">
               <QrCode className="w-4 h-4 text-green-600" />
               Open Scanner Tool
            </button>
         </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm">
                <th className="px-6 py-3 font-semibold">Time</th>
                {role !== 'student' && <th className="px-6 py-3 font-semibold">Student Name</th>}
                {role !== 'student' && <th className="px-6 py-3 font-semibold">Room</th>}
                <th className="px-6 py-3 font-semibold">Meal</th>
                <th className="px-6 py-3 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map(record => (
                <tr key={record.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                    {new Date(record.marked_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </td>
                  {role !== 'student' && (
                     <td className="px-6 py-4 font-medium text-gray-800">
                        {record.students?.name || 'Unknown User'}
                     </td>
                  )}
                  {role !== 'student' && (
                     <td className="px-6 py-4 text-sm text-gray-600">
                        {record.students?.room_no || 'N/A'}
                     </td>
                  )}
                  <td className="px-6 py-4 text-sm font-semibold text-gray-700">
                     {record.meal || 'ANY'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {record.status}
                    </span>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={role !== 'student' ? 5 : 3} className="px-6 py-12 text-center text-gray-500">
                    No attendance records for this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
