import { supabase } from '../supabaseConfig.js';

let currentStudent = null;

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

  if (!profile || profile.role !== 'student') {
    alert('Access denied. Student privileges required.');
    await supabase.auth.signOut();
    window.location.href = 'login.html';
    return null;
  }

  // Fetch the student profile, including the mess_id
  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!student) {
    alert('Student profile not found.');
    await supabase.auth.signOut();
    window.location.href = 'login.html';
    return null;
  }

  return student;
}

async function loadStudentInfo() {
  if (!currentStudent) return;

  // Display student name
  document.getElementById('studentName').textContent = currentStudent.name;
  document.getElementById('welcomeName').textContent = currentStudent.name;

  // Fetch and display mess name
  if (currentStudent.mess_id) {
    // This is the new, simpler query
    const { data: messAdmin, error } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', currentStudent.mess_id)
      .single();

    if (messAdmin && messAdmin.full_name) {
      document.getElementById('messName').textContent = messAdmin.full_name;
    } else {
      document.getElementById('messName').textContent = 'N/A';
    }
  } else {
    document.getElementById('messName').textContent = 'N/A';
  }
}


async function loadAttendanceStats() {
  if (!currentStudent) return;

  const { data: attendance } = await supabase
    .from('attendance')
    .select('*')
    .eq('student_id', currentStudent.id);

  const totalDays = attendance?.length || 0;
  const presentDays = attendance?.filter(a => a.status === 'Present').length || 0;
  const attendanceRate = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : 0;

  document.getElementById('attendancePercentage').textContent = `${attendanceRate}%`;
  document.getElementById('daysPresent').textContent = presentDays;

  const recentContainer = document.getElementById('recentAttendance');
  if (attendance && attendance.length > 0) {
    const recent = attendance.slice(0, 7);
    recentContainer.innerHTML = recent.map(record => `
      <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
        <div>
          <p class="font-semibold text-gray-800">${new Date(record.date).toLocaleDateString()}</p>
          <p class="text-xs text-gray-500">${new Date(record.marked_at).toLocaleTimeString()}</p>
        </div>
        <span class="px-3 py-1 rounded-full text-xs font-semibold ${record.status === 'Present' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
          ${record.status}
        </span>
      </div>
    `).join('');
  } else {
    recentContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No attendance records yet</p>';
  }
}

async function loadPaymentInfo() {
  if (!currentStudent) return;

  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('student_id', currentStudent.id)
    .order('due_date', { ascending: false });

  const statusEl = document.getElementById('paymentStatus');
  const historyContainer = document.getElementById('paymentHistory');
  historyContainer.innerHTML = ''; // Clear previous entries

  if (!payments || payments.length === 0) {
    statusEl.innerHTML = `<span class="text-green-600">No Bills</span>`;
    historyContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No payment records</p>';
    return;
  }
  
  const pendingPayments = payments.filter(p => p.status === 'Pending' || p.status === 'Partially Paid');

  if (pendingPayments.length > 0) {
    const nextDue = pendingPayments[0];
    const dueAmount = nextDue.total_amount - nextDue.paid_amount;
    statusEl.innerHTML = `<span class="text-red-600">Due: ₹${dueAmount.toFixed(2)}</span>`;
  } else {
    statusEl.innerHTML = `<span class="text-green-600">All Paid</span>`;
  }
  
  payments.slice(0, 5).forEach(payment => {
      const remaining = payment.total_amount - payment.paid_amount;
      const statusColor = payment.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
      
      historyContainer.innerHTML += `
        <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
          <div>
            <p class="font-semibold text-gray-800">Bill: ₹${payment.total_amount}</p>
            <p class="text-xs text-gray-500">Paid: ₹${payment.paid_amount}</p>
            <p class="text-xs text-red-500 font-semibold">Remaining: ₹${remaining > 0 ? remaining.toFixed(2) : 0}</p>
            <p class="text-xs text-gray-500">Due: ${new Date(payment.due_date).toLocaleDateString()}</p>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-semibold ${statusColor}">
            ${payment.status}
          </span>
        </div>
      `;
  });
}

async function loadPlanDaysRemaining() {
  if (!currentStudent || !currentStudent.plan_type || !currentStudent.plan_start_date) {
    document.getElementById('daysRemaining').textContent = 'N/A';
    return;
  }

  const { data: plan, error } = await supabase
    .from('plans')
    .select('duration_days')
    .eq('mess_id', currentStudent.mess_id)
    .eq('name', currentStudent.plan_type)
    .single();

  if (plan) {
    const startDate = new Date(currentStudent.plan_start_date);
    const expiryDate = new Date(startDate.setDate(startDate.getDate() + plan.duration_days));
    const today = new Date();
    const diffTime = expiryDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    document.getElementById('daysRemaining').textContent = diffDays > 0 ? diffDays : 'Expired';
  } else {
    document.getElementById('daysRemaining').textContent = 'N/A';
  }
}

async function loadTodayMenu() {
    if (!currentStudent || !currentStudent.mess_id) return;
  const today = new Date().toISOString().split('T')[0];

  const { data: menu } = await supabase
    .from('menu')
    .select('*')
    .eq('mess_id', currentStudent.mess_id)
    .eq('date', today)
    .maybeSingle();

  if (menu) {
    document.getElementById('breakfast').textContent = menu.breakfast || 'Not available';
    document.getElementById('lunch').textContent = menu.lunch || 'Not available';
    document.getElementById('dinner').textContent = menu.dinner || 'Not available';
  } else {
    document.getElementById('breakfast').textContent = 'Not available';
    document.getElementById('lunch').textContent = 'Not available';
    document.getElementById('dinner').textContent = 'Not available';
  }
}

// Helper function to determine meal type based on time
function getMealTypeByTime() {
    const hour = new Date().getHours();
    if (hour >= 7 && hour < 11) return 'BREAKFAST'; // 7:00 - 10:59
    if (hour >= 12 && hour < 16) return 'LUNCH';   // 12:00 - 15:59
    if (hour >= 19 && hour < 22) return 'DINNER';  // 19:00 - 21:59
    return null; // No meal service is active
}

async function checkTodayAttendance() {
  if (!currentStudent) return;
  const btn = document.getElementById('markAttendanceBtn');
  const msg = document.getElementById('attendanceMessage');
  const meal = getMealTypeByTime();

  if (!meal) {
    btn.disabled = true;
    btn.textContent = 'No Meal Service Active';
    msg.textContent = '';
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('student_id', currentStudent.id)
    .eq('date', today)
    .eq('meal', meal)
    .maybeSingle();

  if (data) {
    btn.disabled = true;
    btn.textContent = `Attendance Marked for ${meal}`;
    msg.textContent = `Marked at ${new Date(data.marked_at).toLocaleTimeString()}`;
    msg.className = 'mt-4 text-sm text-green-600 font-semibold';
  } else {
    btn.disabled = false;
    btn.textContent = `Tap to Mark for ${meal}`;
    msg.textContent = '';
  }
}

document.getElementById('markAttendanceBtn').addEventListener('click', async () => {
  if (!currentStudent || !currentStudent.mess_id) return;

  const btn = document.getElementById('markAttendanceBtn');
  const msg = document.getElementById('attendanceMessage');
  const meal = getMealTypeByTime();

  if (!meal) {
    alert('No meal service is currently active.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Marking...';

  const today = new Date().toISOString().split('T')[0];

  try {
    const { error } = await supabase.from('attendance').insert({
        student_id: currentStudent.id,
        date: today,
        status: 'Present',
        meal: meal,
        mess_id: currentStudent.mess_id
      });
    if (error) {
      if (error.code === '23505') throw new Error(`Attendance for ${meal} is already marked today.`);
      throw error;
    }
    msg.textContent = 'Attendance marked successfully!';
    msg.className = 'mt-4 text-sm text-green-600 font-semibold';
    btn.textContent = `Attendance Marked for ${meal}`;
    loadAttendanceStats();
  } catch (error) {
    msg.textContent = error.message;
    msg.className = 'mt-4 text-sm text-red-600 font-semibold';
    btn.disabled = false;
    btn.textContent = `Tap to Mark for ${meal}`;
  }
});

document.getElementById('downloadReceiptBtn').addEventListener('click', async () => {
  if (!currentStudent) return;

  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('student_id', currentStudent.id)
    .eq('status', 'Paid')
    .order('paid_on', { ascending: false })
    .limit(1);

  if (!payments || payments.length === 0) {
    alert('No paid receipts available');
    return;
  }

  const payment = payments[0];
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.text('Payment Receipt', 105, 20, { align: 'center' });

  doc.setFontSize(12);
  doc.text(`Student: ${currentStudent.name}`, 20, 40);
  doc.text(`Email: ${currentStudent.email}`, 20, 50);
  doc.text(`Room: ${currentStudent.room_no}`, 20, 60);
  doc.text(`Plan: ${currentStudent.plan_type}`, 20, 70);

  doc.text(`Amount Paid: ₹${payment.amount}`, 20, 90);
  doc.text(`Payment Date: ${new Date(payment.paid_on).toLocaleDateString()}`, 20, 100);
  doc.text(`Status: ${payment.status}`, 20, 110);

  doc.save(`receipt_${payment.id}.pdf`);
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
});

document.addEventListener('DOMContentLoaded', async () => {
  currentStudent = await checkAuth();
  if (currentStudent) {
    await loadStudentInfo();
    await loadAttendanceStats();
    await loadPaymentInfo();
    await loadTodayMenu();
    await checkTodayAttendance();
    await loadPlanDaysRemaining();
  }
});