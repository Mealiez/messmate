import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { useTenantContext } from '../../core/context/TenantContext';
import { Users, UserPlus, Search, X, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  email: string;
  mobile: string;
  rfid_tag: string;
  plan_type: string;
  room_no: string;
  status: string;
  created_at: string;
}

export const StudentManagementModule: React.FC = () => {
  const { tenantId } = useTenantContext();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', mobile: '', rfid_tag: '', plan_type: 'Monthly', room_no: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (tenantId) fetchStudents();
  }, [tenantId]);

  const fetchStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (!error) setStudents(data || []);
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const { error } = await supabase.from('students').insert({
      ...form,
      tenant_id: tenantId,
      status: 'Active',
    });
    if (error) {
      setError(error.message);
    } else {
      setShowAddForm(false);
      setForm({ name: '', email: '', mobile: '', rfid_tag: '', plan_type: 'Monthly', room_no: '' });
      fetchStudents();
    }
    setSaving(false);
  };

  const toggleStatus = async (student: Student) => {
    const newStatus = student.status === 'Active' ? 'Inactive' : 'Active';
    await supabase.from('students').update({ status: newStatus }).eq('id', student.id);
    fetchStudents();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return;
    await supabase.from('students').delete().eq('id', id);
    fetchStudents();
  };

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    s.room_no.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Student Management</h3>
            <p className="text-sm text-gray-500">{students.length} enrolled students</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-semibold"
        >
          {showAddForm ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          {showAddForm ? 'Cancel' : 'Add Student'}
        </button>
      </div>

      {/* Add Student Form */}
      {showAddForm && (
        <div className="p-6 bg-blue-50 border-b">
          <h4 className="font-bold text-gray-800 mb-4">Add New Student</h4>
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Full Name', key: 'name', type: 'text' },
              { label: 'Email', key: 'email', type: 'email' },
              { label: 'Mobile', key: 'mobile', type: 'text' },
              { label: 'RFID Tag', key: 'rfid_tag', type: 'text' },
              { label: 'Room No', key: 'room_no', type: 'text' },
            ].map(field => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                <input
                  type={field.type}
                  required
                  value={(form as any)[field.key]}
                  onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan Type</label>
              <select
                value={form.plan_type}
                onChange={e => setForm({ ...form, plan_type: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Monthly">Monthly</option>
                <option value="Weekly">Weekly</option>
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Student'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="px-6 py-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or room..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm">
                <th className="px-6 py-3 font-semibold">Name</th>
                <th className="px-6 py-3 font-semibold">Contact</th>
                <th className="px-6 py-3 font-semibold">Room</th>
                <th className="px-6 py-3 font-semibold">Plan</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(student => (
                <tr key={student.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 font-medium text-gray-800">{student.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div>{student.email}</div>
                    <div className="text-xs text-gray-400">{student.mobile}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{student.room_no}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{student.plan_type}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      student.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {student.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleStatus(student)}
                        title={student.status === 'Active' ? 'Deactivate' : 'Activate'}
                        className="text-gray-400 hover:text-blue-600 transition"
                      >
                        {student.status === 'Active' ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(student.id)}
                        className="text-gray-400 hover:text-red-600 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No students found.
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
