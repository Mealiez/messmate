import { supabase } from '../supabaseConfig.js';

let currentParentId = null;

async function checkAuth() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    window.location.href = 'login.html';
    return null;
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'parent') {
    alert('Access denied. Parent privileges required.');
    await supabase.auth.signOut();
    window.location.href = 'login.html';
    return null;
  }

  return user.id;
}

async function loadChildren() {
  if (!currentParentId) return;

  const { data: children, error } = await supabase
    .from('students')
    .select('*')
    .eq('parent_id', currentParentId);

  const container = document.getElementById('studentsContainer');
  const noStudentsMsg = document.getElementById('noStudentsMessage');

  if (!children || children.length === 0) {
    noStudentsMsg.classList.remove('hidden');
    container.innerHTML = '';
    return;
  }

  noStudentsMsg.classList.add('hidden');
  container.innerHTML = '';

  for (const child of children) {
    const card = await createStudentCard(child);
    container.appendChild(card);
  }
}

async function createStudentCard(student) {
  const { data: attendance } = await supabase
    .from('attendance')
    .select('*')
    .eq('student_id', student.id);

  const totalDays = attendance?.length || 0;
  const presentDays = attendance?.filter(a => a.status === 'Present').length || 0;
  const attendanceRate = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : 0;

  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('student_id', student.id)
    .order('due_date', { ascending: false })
    .limit(3);

  const { data: todayMenu } = await supabase
    .from('menu')
    .select('*')
    .eq('date', new Date().toISOString().split('T')[0])
    .maybeSingle();

  const recentAttendance = attendance?.slice(-7) || [];

  const cardDiv = document.createElement('div');
  cardDiv.className = 'bg-white rounded-2xl shadow-lg p-8 mb-8';
  cardDiv.innerHTML = `
    <div class="flex items-center justify-between mb-6 pb-6 border-b">
      <div>
        <h2 class="text-2xl font-bold text-gray-800">${student.name}</h2>
        <p class="text-gray-600">Room ${student.room_no} • ${student.plan_type} Plan</p>
      </div>
      <div class="text-right">
        <span class="px-4 py-2 rounded-full text-sm font-semibold ${student.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
          ${student.status}
        </span>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-blue-50 rounded-lg p-6">
        <div class="flex items-center justify-between mb-2">
          <p class="text-sm text-gray-600">Attendance Rate</p>
          <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <p class="text-3xl font-bold text-gray-800">${attendanceRate}%</p>
        <p class="text-xs text-gray-500 mt-1">${presentDays} of ${totalDays} days</p>
      </div>

      <div class="bg-green-50 rounded-lg p-6">
        <div class="flex items-center justify-between mb-2">
          <p class="text-sm text-gray-600">Contact</p>
          <svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
        </div>
        <p class="text-sm font-semibold text-gray-800">${student.email}</p>
        <p class="text-sm text-gray-600 mt-1">${student.mobile}</p>
      </div>

      <div class="bg-yellow-50 rounded-lg p-6">
        <div class="flex items-center justify-between mb-2">
          <p class="text-sm text-gray-600">RFID Tag</p>
          <svg class="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/>
          </svg>
        </div>
        <p class="text-lg font-semibold text-gray-800">${student.rfid_tag}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <div>
        <h3 class="text-lg font-bold text-gray-800 mb-4">Recent Attendance</h3>
        <div class="space-y-3">
          ${recentAttendance.length > 0 ? recentAttendance.map(record => `
            <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div>
                <p class="font-semibold text-gray-800">${new Date(record.date).toLocaleDateString()}</p>
                <p class="text-xs text-gray-500">${new Date(record.marked_at).toLocaleTimeString()}</p>
              </div>
              <span class="px-3 py-1 rounded-full text-xs font-semibold ${record.status === 'Present' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                ${record.status}
              </span>
            </div>
          `).join('') : '<p class="text-gray-500 text-center py-4">No attendance records yet</p>'}
        </div>
      </div>

      <div>
        <h3 class="text-lg font-bold text-gray-800 mb-4">Payment History</h3>
        <div class="space-y-3">
          ${payments && payments.length > 0 ? payments.map(payment => `
            <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div>
                <p class="font-semibold text-gray-800">₹${payment.amount}</p>
                <p class="text-xs text-gray-500">Due: ${new Date(payment.due_date).toLocaleDateString()}</p>
                ${payment.paid_on ? `<p class="text-xs text-gray-500">Paid: ${new Date(payment.paid_on).toLocaleDateString()}</p>` : ''}
              </div>
              <span class="px-3 py-1 rounded-full text-xs font-semibold ${payment.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                ${payment.status}
              </span>
            </div>
          `).join('') : '<p class="text-gray-500 text-center py-4">No payment records</p>'}
        </div>
      </div>
    </div>

    <div>
      <h3 class="text-lg font-bold text-gray-800 mb-4">Today's Menu</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-orange-50 rounded-lg p-6">
          <div class="flex items-center mb-3">
            <svg class="h-6 w-6 text-orange-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"/>
            </svg>
            <h4 class="font-bold text-gray-800">Breakfast</h4>
          </div>
          <p class="text-gray-600">${todayMenu?.breakfast || 'Not available'}</p>
        </div>

        <div class="bg-yellow-50 rounded-lg p-6">
          <div class="flex items-center mb-3">
            <svg class="h-6 w-6 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M12 8a4 4 0 100 8 4 4 0 000-8z"/>
            </svg>
            <h4 class="font-bold text-gray-800">Lunch</h4>
          </div>
          <p class="text-gray-600">${todayMenu?.lunch || 'Not available'}</p>
        </div>

        <div class="bg-blue-50 rounded-lg p-6">
          <div class="flex items-center mb-3">
            <svg class="h-6 w-6 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
            </svg>
            <h4 class="font-bold text-gray-800">Dinner</h4>
          </div>
          <p class="text-gray-600">${todayMenu?.dinner || 'Not available'}</p>
        </div>
      </div>
    </div>
  `;

  return cardDiv;
}

supabase
  .channel('students_changes')
  .on('postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'students',
      filter: `parent_id=eq.${currentParentId}`
    },
    () => {
      loadChildren();
    }
  )
  .subscribe();

supabase
  .channel('attendance_changes')
  .on('postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'attendance'
    },
    () => {
      loadChildren();
    }
  )
  .subscribe();

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
});

document.addEventListener('DOMContentLoaded', async () => {
  currentParentId = await checkAuth();
  if (currentParentId) {
    await loadChildren();
  }
});
