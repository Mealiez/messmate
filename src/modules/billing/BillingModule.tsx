import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { useTenantContext } from '../../core/context/TenantContext';
import { CreditCard, Plus, CheckCircle, Clock, X } from 'lucide-react';

interface Payment {
  id: string;
  student_id: string;
  amount: number;
  status: string;
  due_date: string;
  paid_on: string | null;
  created_at: string;
  students?: { name: string; email: string };
}

export const BillingModule: React.FC = () => {
  const { tenantId } = useTenantContext();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ student_id: '', amount: '', due_date: '' });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'All' | 'Paid' | 'Pending'>('All');

  useEffect(() => {
    if (tenantId) {
      fetchPayments();
      fetchStudentsList();
    }
  }, [tenantId]);

  const fetchPayments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('payments')
      .select('*, students(name, email)')
      .eq('tenant_id', tenantId)
      .order('due_date', { ascending: false });
    setPayments(data || []);
    setLoading(false);
  };

  const fetchStudentsList = async () => {
    const { data } = await supabase
      .from('students')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('status', 'Active');
    setStudents(data || []);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await supabase.from('payments').insert({
      student_id: form.student_id,
      tenant_id: tenantId,
      amount: parseFloat(form.amount),
      due_date: form.due_date,
      status: 'Pending',
    });
    setShowAddForm(false);
    setForm({ student_id: '', amount: '', due_date: '' });
    fetchPayments();
    setSaving(false);
  };

  const markPaid = async (payment: Payment) => {
    await supabase
      .from('payments')
      .update({ status: 'Paid', paid_on: new Date().toISOString().split('T')[0] })
      .eq('id', payment.id);
    fetchPayments();
  };

  const deletePayment = async (id: string) => {
    if (!confirm('Delete this payment record?')) return;
    await supabase.from('payments').delete().eq('id', id);
    fetchPayments();
  };

  const filtered = payments.filter(p => filter === 'All' || p.status === filter);
  const totalPending = payments.filter(p => p.status === 'Pending').reduce((acc, p) => acc + p.amount, 0);
  const totalCollected = payments.filter(p => p.status === 'Paid').reduce((acc, p) => acc + p.amount, 0);

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-purple-100 p-2 rounded-lg">
            <CreditCard className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Billing & Payments</h3>
            <p className="text-sm text-gray-500">{payments.filter(p => p.status === 'Pending').length} pending dues</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition text-sm font-semibold"
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAddForm ? 'Cancel' : 'Add Payment'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-6 border-b bg-gray-50">
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-purple-500">
          <p className="text-gray-500 text-xs font-semibold uppercase">Total Pending</p>
          <h3 className="text-2xl font-bold text-gray-800">₹{totalPending.toLocaleString()}</h3>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
          <p className="text-gray-500 text-xs font-semibold uppercase">Total Collected</p>
          <h3 className="text-2xl font-bold text-gray-800">₹{totalCollected.toLocaleString()}</h3>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500 col-span-2 md:col-span-1">
          <p className="text-gray-500 text-xs font-semibold uppercase">Total Records</p>
          <h3 className="text-2xl font-bold text-gray-800">{payments.length}</h3>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="p-6 bg-purple-50 border-b">
          <h4 className="font-bold text-gray-800 mb-4">Add Payment Record</h4>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
              <select
                required
                value={form.student_id}
                onChange={e => setForm({ ...form, student_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select student...</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
              <input
                type="number"
                required
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                placeholder="e.g. 2500"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                required
                value={form.due_date}
                onChange={e => setForm({ ...form, due_date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Payment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="px-6 py-3 border-b flex gap-2">
        {(['All', 'Paid', 'Pending'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              filter === f ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm">
                <th className="px-6 py-3 font-semibold">Student</th>
                <th className="px-6 py-3 font-semibold">Amount</th>
                <th className="px-6 py-3 font-semibold">Due Date</th>
                <th className="px-6 py-3 font-semibold">Paid On</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(payment => (
                <tr key={payment.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 font-medium text-gray-800">
                    {(payment.students as any)?.name || '—'}
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-800">₹{payment.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{new Date(payment.due_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {payment.paid_on ? new Date(payment.paid_on).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      payment.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {payment.status === 'Pending' && (
                        <button
                          onClick={() => markPaid(payment)}
                          title="Mark as Paid"
                          className="text-gray-400 hover:text-green-600 transition"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deletePayment(payment.id)}
                        className="text-gray-400 hover:text-red-600 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No payment records found.
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
