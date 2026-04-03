import React, { useState, useEffect } from 'react';
import { useTenantContext } from '../../core/context/TenantContext';
import { supabase } from '../../supabase/client';
import { Check, Clock, CalendarIcon } from 'lucide-react';

export const MealRequestsModule: React.FC = () => {
  const { role } = useTenantContext();

  if (role === 'student') {
    return <StudentMealRequestForm />;
  }
  
  if (role === 'admin' || role === 'owner') {
    return <AdminMealRequestLogs />;
  }

  return null;
};

// --- Student Component ---
const StudentMealRequestForm: React.FC = () => {
  const { tenantId, studentId } = useTenantContext();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [mealType, setMealType] = useState('Lunch');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !tenantId) return;
    
    setLoading(true);
    setMessage('');
    
    try {
      const { error } = await supabase.from('meal_requests').upsert(
        { student_id: studentId, tenant_id: tenantId, date, meal_type: mealType, status: 'Requested' },
        { onConflict: 'student_id, date, meal_type' } // Ensure unique index handles this
      );
      
      if (error) {
        if (error.code === '23505') {
            setMessage("You have already requested this meal.");
        } else {
            console.error(error);
            setMessage('Failed to submit request.');
        }
      } else {
        setMessage('Meal request submitted successfully!');
      }
    } catch (err) {
      console.error(err);
      setMessage('An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
          <CalendarIcon size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Pre-Attendance Request</h2>
          <p className="text-sm text-gray-500">Let the mess know you are coming</p>
        </div>
      </div>

      <form onSubmit={submitRequest} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input 
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)}
            className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 border" 
            min={new Date().toISOString().split('T')[0]}
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Meal</label>
          <select 
            value={mealType} 
            onChange={(e) => setMealType(e.target.value)}
            className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 border"
          >
            <option value="Breakfast">Breakfast</option>
            <option value="Lunch">Lunch</option>
            <option value="Dinner">Dinner</option>
          </select>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Submitting...' : 'Confirm Request'}
        </button>

        {message && (
          <p className={`text-center text-sm mt-2 ${message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
            {message}
          </p>
        )}
      </form>
    </div>
  );
};

// --- Admin Component ---
const AdminMealRequestLogs: React.FC = () => {
  const { tenantId } = useTenantContext();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState({ breakfast: 0, lunch: 0, dinner: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      if (!tenantId) return;
      setLoading(true);
      
      try {
        const { data, error } = await supabase
          .from('meal_requests')
          .select('meal_type, id')
          .eq('tenant_id', tenantId)
          .eq('date', date);
          
        if (error) throw error;
        
        const counts = { breakfast: 0, lunch: 0, dinner: 0 };
        data.forEach(req => {
          if (req.meal_type === 'Breakfast') counts.breakfast++;
          if (req.meal_type === 'Lunch') counts.lunch++;
          if (req.meal_type === 'Dinner') counts.dinner++;
        });
        
        setStats(counts);
      } catch (err) {
        console.error("Error fetching stats:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, [date, tenantId]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Meal Requests Log</h2>
          <p className="text-sm text-gray-500">Compare pre-attendance with actuals</p>
        </div>
        <input 
          type="date" 
          value={date} 
          onChange={(e) => setDate(e.target.value)}
          className="border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 border" 
        />
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="Breakfast Requests" count={stats.breakfast} color="bg-orange-50 text-orange-600" />
          <StatCard title="Lunch Requests" count={stats.lunch} color="bg-blue-50 text-blue-600" />
          <StatCard title="Dinner Requests" count={stats.dinner} color="bg-indigo-50 text-indigo-600" />
        </div>
      )}

      {/* Note: Actual presence comparison would require querying the 'attendance' table 
          and joining to get meal-specific attendance if your hardware supports meal-based check-ins */}
      <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-4">
          <div className="p-2 bg-white rounded-lg shadow-sm text-gray-400">
              <Clock size={20} />
          </div>
          <div>
              <h4 className="font-medium text-gray-900">Actual presence comparison</h4>
              <p className="text-sm text-gray-500 mt-1">
                  Once students swipe their RFID tag or are marked present manually for these meals, 
                  the actual count will appear here, helping you track wasted food or plan better.
              </p>
          </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, count, color }: { title: string, count: number, color: string }) => (
  <div className="p-5 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
    <h3 className="text-sm font-medium text-gray-500 mb-2">{title}</h3>
    <div className="flex items-end gap-3">
      <span className="text-4xl font-black text-gray-900">{count}</span>
      <span className={`text-xs font-semibold px-2 py-1 rounded-full mb-1 ${color}`}>
        Requested
      </span>
    </div>
  </div>
);
