import { supabase } from '../supabaseConfig.js';

let attendanceChart, revenueChart;
let reportData = {
  students: [],
  attendance: [],
  payments: []
};

async function checkAuth() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'admin') {
    alert('Access denied. Admin privileges required.');
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  }
}

function setDefaultDates() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  document.getElementById('endDate').valueAsDate = today;
  document.getElementById('startDate').valueAsDate = thirtyDaysAgo;
}

async function generateReport() {
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  const planType = document.getElementById('planType').value;

  if (!startDate || !endDate) {
    alert('Please select both start and end dates');
    return;
  }

  let studentsQuery = supabase.from('students').select('*');
  if (planType) {
    studentsQuery = studentsQuery.eq('plan_type', planType);
  }
  const { data: students } = await studentsQuery;

  const { data: attendance } = await supabase
    .from('attendance')
    .select(`
      *,
      students (name, plan_type)
    `)
    .gte('date', startDate)
    .lte('date', endDate);

  const { data: payments } = await supabase
    .from('payments')
    .select(`
      *,
      students (name, plan_type)
    `)
    .gte('due_date', startDate)
    .lte('due_date', endDate);

  reportData = {
    students: students || [],
    attendance: attendance || [],
    payments: payments || []
  };

  updateSummaryStats();
  updateCharts();
}

function updateSummaryStats() {
  document.getElementById('reportTotalStudents').textContent = reportData.students.length;

  const paidPayments = reportData.payments.filter(p => p.status === 'Paid');
  const totalRevenue = paidPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  document.getElementById('reportTotalRevenue').textContent = `₹${totalRevenue.toFixed(0)}`;

  const pendingPayments = reportData.payments.filter(p => p.status === 'Pending');
  const pendingAmount = pendingPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  document.getElementById('reportPendingAmount').textContent = `₹${pendingAmount.toFixed(0)}`;

  const presentCount = reportData.attendance.filter(a => a.status === 'Present').length;
  const avgAttendance = reportData.attendance.length > 0
    ? ((presentCount / reportData.attendance.length) * 100).toFixed(1)
    : 0;
  document.getElementById('reportAvgAttendance').textContent = `${avgAttendance}%`;
}

function updateCharts() {
  createAttendanceChart();
  createRevenueChart();
}

function createAttendanceChart() {
  const ctx = document.getElementById('reportAttendanceChart');

  if (attendanceChart) {
    attendanceChart.destroy();
  }

  const attendanceByDate = {};
  reportData.attendance.forEach(record => {
    const date = record.date;
    if (!attendanceByDate[date]) {
      attendanceByDate[date] = { present: 0, absent: 0 };
    }
    if (record.status === 'Present') {
      attendanceByDate[date].present++;
    } else {
      attendanceByDate[date].absent++;
    }
  });

  const dates = Object.keys(attendanceByDate).sort();
  const presentCounts = dates.map(date => attendanceByDate[date].present);
  const absentCounts = dates.map(date => attendanceByDate[date].absent);

  attendanceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      datasets: [
        {
          label: 'Present',
          data: presentCounts,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          tension: 0.4
        },
        {
          label: 'Absent',
          data: absentCounts,
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function createRevenueChart() {
  const ctx = document.getElementById('reportRevenueChart');

  if (revenueChart) {
    revenueChart.destroy();
  }

  const paid = reportData.payments
    .filter(p => p.status === 'Paid')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);

  const pending = reportData.payments
    .filter(p => p.status === 'Pending')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);

  revenueChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Paid', 'Pending'],
      datasets: [{
        data: [paid, pending],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(251, 191, 36, 0.8)'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

function exportAttendanceCSV() {
  const headers = ['Student Name', 'Date', 'Status', 'Marked At'];
  const rows = reportData.attendance.map(record => [
    record.students?.name || 'Unknown',
    record.date,
    record.status,
    new Date(record.marked_at).toLocaleString()
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  downloadCSV(csvContent, 'attendance_report.csv');
}

function exportPaymentsCSV() {
  const headers = ['Student Name', 'Amount', 'Due Date', 'Status', 'Paid On'];
  const rows = reportData.payments.map(payment => [
    payment.students?.name || 'Unknown',
    payment.amount,
    payment.due_date,
    payment.status,
    payment.paid_on || 'N/A'
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  downloadCSV(csvContent, 'payments_report.csv');
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

function exportAttendancePDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text('Attendance Report', 105, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 105, 22, { align: 'center' });

  const tableData = reportData.attendance.map(record => [
    record.students?.name || 'Unknown',
    new Date(record.date).toLocaleDateString(),
    record.status,
    new Date(record.marked_at).toLocaleString()
  ]);

  doc.autoTable({
    startY: 30,
    head: [['Student Name', 'Date', 'Status', 'Marked At']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] }
  });

  doc.save('attendance_report.pdf');
}

function exportPaymentsPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text('Payments Report', 105, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 105, 22, { align: 'center' });

  const paidTotal = reportData.payments
    .filter(p => p.status === 'Paid')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);

  const pendingTotal = reportData.payments
    .filter(p => p.status === 'Pending')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);

  doc.text(`Total Paid: ₹${paidTotal.toFixed(2)}`, 20, 30);
  doc.text(`Total Pending: ₹${pendingTotal.toFixed(2)}`, 20, 37);

  const tableData = reportData.payments.map(payment => [
    payment.students?.name || 'Unknown',
    `₹${payment.amount}`,
    new Date(payment.due_date).toLocaleDateString(),
    payment.status,
    payment.paid_on ? new Date(payment.paid_on).toLocaleDateString() : 'N/A'
  ]);

  doc.autoTable({
    startY: 45,
    head: [['Student Name', 'Amount', 'Due Date', 'Status', 'Paid On']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] }
  });

  doc.save('payments_report.pdf');
}

document.getElementById('generateReportBtn').addEventListener('click', generateReport);
document.getElementById('exportAttendanceCSV').addEventListener('click', exportAttendanceCSV);
document.getElementById('exportPaymentsCSV').addEventListener('click', exportPaymentsCSV);
document.getElementById('exportAttendancePDF').addEventListener('click', exportAttendancePDF);
document.getElementById('exportPaymentsPDF').addEventListener('click', exportPaymentsPDF);

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
});

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  setDefaultDates();
  generateReport();
});
