import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { useTenantContext } from '../../core/context/TenantContext';
import { Utensils, Calendar, Save } from 'lucide-react';

export const MenuModule: React.FC = () => {
  const { tenantId, role } = useTenantContext();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [menu, setMenu] = useState({ breakfast: '', lunch: '', dinner: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (tenantId) fetchMenu();
  }, [tenantId, date]);

  const fetchMenu = async () => {
    setLoading(true);
    setMessage(null);
    const { data } = await supabase
      .from('menu')
      .select('breakfast, lunch, dinner')
      .eq('tenant_id', tenantId)
      .eq('date', date)
      .maybeSingle();
      
    if (data) {
      setMenu(data);
    } else {
      setMenu({ breakfast: '', lunch: '', dinner: '' });
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    
    setSaving(true);
    setMessage(null);
    
    const { error } = await supabase.from('menu').upsert(
      { tenant_id: tenantId, date, breakfast: menu.breakfast, lunch: menu.lunch, dinner: menu.dinner },
      { onConflict: 'tenant_id, date' } // Assuming a unique constraint exists on tenant_id + date
    );

    if (error) {
      console.error(error);
      setMessage({ text: 'Failed to save menu.', type: 'error' });
    } else {
      setMessage({ text: 'Menu saved successfully!', type: 'success' });
    }
    setSaving(false);
  };

  const isAdmin = role === 'admin' || role === 'owner';

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between bg-red-50">
        <div className="flex items-center gap-3">
          <div className="bg-red-100 p-2 rounded-lg">
            <Utensils className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Menu Management</h3>
            <p className="text-sm text-gray-500">Plan daily meals</p>
          </div>
        </div>
        <div className="relative">
          {/* Note: The old UI didn't have this exact date picker in the header, but it's essential for a menu */}
          <div className="flex items-center bg-white border border-gray-300 rounded-lg px-3 py-1 shadow-sm">
             <Calendar className="w-4 h-4 text-gray-400 mr-2" />
             <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="focus:outline-none text-sm text-gray-700 bg-transparent"
             />
          </div>
        </div>
      </div>

      <div className="p-6">
        {loading ? (
           <div className="flex justify-center p-12">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
           </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Breakfast */}
              <div className="bg-orange-50 rounded-xl p-6 border border-orange-100">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center mr-3">
                    <span className="text-lg">🌅</span>
                  </div>
                  <h4 className="font-bold text-gray-800 text-lg">Breakfast</h4>
                </div>
                {isAdmin ? (
                  <textarea
                    value={menu.breakfast}
                    onChange={(e) => setMenu({...menu, breakfast: e.target.value})}
                    placeholder="e.g. Idli, Sambar, Chutney, Tea"
                    className="w-full h-32 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 resize-none text-sm"
                  />
                ) : (
                  <p className="text-gray-700 whitespace-pre-wrap">{menu.breakfast || 'Not planned yet'}</p>
                )}
              </div>

              {/* Lunch */}
              <div className="bg-yellow-50 rounded-xl p-6 border border-yellow-100">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center mr-3">
                    <span className="text-lg">☀️</span>
                  </div>
                  <h4 className="font-bold text-gray-800 text-lg">Lunch</h4>
                </div>
                {isAdmin ? (
                  <textarea
                    value={menu.lunch}
                    onChange={(e) => setMenu({...menu, lunch: e.target.value})}
                    placeholder="e.g. Chapati, Dal, Rice, Subji"
                    className="w-full h-32 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-500 resize-none text-sm"
                  />
                ) : (
                  <p className="text-gray-700 whitespace-pre-wrap">{menu.lunch || 'Not planned yet'}</p>
                )}
              </div>

              {/* Dinner */}
              <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                    <span className="text-lg">🌙</span>
                  </div>
                  <h4 className="font-bold text-gray-800 text-lg">Dinner</h4>
                </div>
                {isAdmin ? (
                  <textarea
                    value={menu.dinner}
                    onChange={(e) => setMenu({...menu, dinner: e.target.value})}
                    placeholder="e.g. Pulao, Raita, Dessert"
                    className="w-full h-32 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                  />
                ) : (
                  <p className="text-gray-700 whitespace-pre-wrap">{menu.dinner || 'Not planned yet'}</p>
                )}
              </div>
            </div>
            
            {isAdmin && (
              <div className="flexitems-center justify-between border-t border-gray-100 mt-6 pt-6 flex">
                <div className="text-sm">
                  {message && (
                    <span className={`font-medium ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                      {message.text}
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 bg-red-600 text-white px-6 py-2.5 rounded-lg hover:bg-red-700 transition font-semibold disabled:opacity-50 shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Menu'}
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
