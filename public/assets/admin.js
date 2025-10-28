import { supabase } from '../supabaseConfig.js';

let attendanceChart, paymentChart;

// Helper to get the current admin's user ID
async function getAdminId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user ? user.id : null;
}

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

// --- QR SCANNER FUNCTIONS ---
let html5QrcodeScanner;
function getMealTypeByTime() {
    const hour = new Date().getHours();
    if (hour >= 7 && hour < 11) return 'BREAKFAST';
    if (hour >= 12 && hour < 17) return 'LUNCH';
    if (hour >= 19 && hour < 22) return 'DINNER';
    return null;
}
// Helper to get the PREVIOUS meal based on current time
function getPreviousMealType() {
    const hour = new Date().getHours();
    if (hour >= 11 && hour < 16) return 'BREAKFAST'; // If it's lunch time or later, mark breakfast
    if (hour >= 16 && hour < 22) return 'LUNCH';   // If it's dinner time or later, mark lunch
    if (hour >= 22 || hour < 7) return 'DINNER';  // If it's after dinner or early morning, mark dinner
    return null; // No meal has passed yet today to mark
}

async function onScanSuccess(decodedText, decodedResult) {
    const studentId = decodedText;
    const scanResultEl = document.getElementById('scanResult');
    scanResultEl.textContent = 'Processing...';
    scanResultEl.className = 'mt-4 text-center font-semibold text-lg text-gray-500';

    if (html5QrcodeScanner && html5QrcodeScanner.getState() === 2) {
        html5QrcodeScanner.pause();
    }

    try {
        const adminId = await getAdminId();
        if (!adminId) throw new Error("Could not verify admin.");

        const meal = getMealTypeByTime();
        if (!meal) throw new Error('No meal service is active at this time.');

        const { data: student, error: studentError } = await supabase
            .from('students')
            .select('id, name')
            .eq('id', studentId)
            .eq('mess_id', adminId)
            .single();
        if (studentError) throw new Error('Student not found in this mess.');

        const today = new Date().toISOString().split('T')[0];
        const { data: existingAttendance, error: attendanceError } = await supabase
            .from('attendance')
            .select('id')
            .eq('student_id', studentId)
            .eq('date', today)
            .eq('meal', meal);
        if (attendanceError) throw new Error('Error checking for duplicates.');
        if (existingAttendance && existingAttendance.length > 0) {
            throw new Error(`Attendance for ${student.name} (${meal}) is already marked.`);
        }

        const { error: insertError } = await supabase.from('attendance').insert({
            student_id: studentId,
            meal: meal,
            status: 'PRESENT',
            date: today,
            mess_id: adminId
        });

        // --- DEBUGGING CHANGE IS HERE ---
        if (insertError) {
            console.error("DETAILED SUPABASE ERROR:", insertError); // This will show the real error
            throw new Error('Error saving attendance. Check console for details.');
        }

        scanResultEl.textContent = `Success! Attendance marked for ${student.name}.`;
        scanResultEl.className = 'mt-4 text-center font-semibold text-lg text-green-600';

    } catch (error) {
        scanResultEl.textContent = `Error: ${error.message}`;
        scanResultEl.className = 'mt-4 text-center font-semibold text-lg text-red-600';
    } finally {
        setTimeout(() => {
            if (html5QrcodeScanner && html5QrcodeScanner.getState() === 3) {
                html5QrcodeScanner.resume();
                scanResultEl.textContent = '';
            }
        }, 2500);
    }
}

function onScanFailure(error) { /* Ignore */ }

function loadScanner() {
    if (!html5QrcodeScanner) {
         html5QrcodeScanner = new window.Html5QrcodeScanner( // <-- This is the fix
            "qr-reader",
            { fps: 10, qrbox: { width: 250, height: 250 } },
            false // verbose = false
        );
    }
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
}

function stopScanner() {
    if (html5QrcodeScanner && html5QrcodeScanner.getState() !== 1) { // 1 === NOT_STARTED
         html5QrcodeScanner.clear().catch(err => console.error("Failed to clear scanner:", err));
         html5QrcodeScanner = null;
    }
}

function setupSidebarToggle() {
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const navLinks = document.querySelectorAll('.nav-link');

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('-translate-x-full');
      sidebarOverlay.classList.toggle('hidden');
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
      sidebar.classList.add('-translate-x-full');
      sidebarOverlay.classList.add('hidden');
    });
  }
  
  // Hide sidebar when a nav link is clicked on mobile
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
        // Tailwind's 'md' breakpoint is 768px
        if (window.innerWidth < 768) { 
            sidebar.classList.add('-translate-x-full');
            sidebarOverlay.classList.add('hidden');
        }
    });
  });
}

function setupNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.content-section');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      
      const sectionName = link.dataset.section;

      // If the link has no data-section (like the "Reports" link),
      // let the browser navigate normally and stop this script.
      if (!sectionName) {
        return;
      }

      // Only prevent default for in-page section links
      e.preventDefault();

      navLinks.forEach(l => l.classList.remove('bg-blue-600'));
      navLinks.forEach(l => l.classList.add('hover:bg-gray-800'));
      link.classList.add('bg-blue-600');
      link.classList.remove('hover:bg-gray-800');

      sections.forEach(s => s.classList.add('hidden'));
      document.getElementById(`${sectionName}Section`).classList.remove('hidden');

      document.getElementById('pageTitle').textContent =
        sectionName.charAt(0).toUpperCase() + sectionName.slice(1);

      switch(sectionName) {
        case 'dashboard':
          loadDashboard();
          break;
        case 'students':
          loadStudents();
          break;
        case 'attendance':
          loadAttendance();
          break;
        case 'payments':
          loadPayments();
          break;
        case 'plans': 
          loadPlans();
          break;
        case 'messInfo': 
          loadMessInfo(); 
          break;
        case 'menu':
          loadMenu();
          break;
        case 'scan': 
          loadScanner();
          break;
      
      }
    });
  });
}


async function displayMessId() {
  const adminId = await getAdminId();
  const messIdElement = document.getElementById('messIdDisplay');
  const copyBtn = document.getElementById('copyMessIdBtn');
  const copyFeedback = document.getElementById('copyFeedback'); 

  if (adminId && messIdElement) {
    messIdElement.textContent = adminId;

    if (copyBtn) {
      copyBtn.onclick = () => {
        try {
          const tempTextArea = document.createElement('textarea');
          tempTextArea.value = adminId;
          document.body.appendChild(tempTextArea);
          tempTextArea.select();
          document.execCommand('copy');
          document.body.removeChild(tempTextArea);
          
          copyFeedback.textContent = 'Copied!';
          setTimeout(() => { copyFeedback.textContent = ''; }, 2000);
        } catch (err) {
          console.error('Failed to copy Mess ID: ', err);
          copyFeedback.textContent = 'Copy failed';
           setTimeout(() => { copyFeedback.textContent = ''; }, 2000);
        }
      };
    }
  } else if (messIdElement) {
    messIdElement.textContent = 'Could not load ID';
  }
}

async function loadDashboard() {
  await displayMessId();
  const adminId = await getAdminId();
  if (!adminId) return;

  const { data: students } = await supabase
    .from('students')
    .select('*', { count: 'exact' })
    .eq('mess_id', adminId);

  document.getElementById('totalStudents').textContent = students?.length || 0;

  // Correctly fetch all necessary payment data
  const { data: payments } = await supabase
    .from('payments')
    .select('total_amount, paid_amount, status')
    .eq('mess_id', adminId);

  // Calculate revenue by summing all amounts that have been paid
  const revenue = payments?.reduce((sum, p) => sum + parseFloat(p.paid_amount), 0) || 0;
  document.getElementById('monthlyRevenue').textContent = `₹${revenue.toFixed(0)}`;

  // Count payments that are not fully paid
  const pendingCount = payments?.filter(p => p.status === 'Pending' || p.status === 'Partially Paid').length || 0;
  document.getElementById('pendingPayments').textContent = pendingCount;

  const today = new Date().toISOString().split('T')[0];
  const { data: todayAttendance } = await supabase
    .from('attendance')
    .select('*', { count: 'exact' })
    .eq('mess_id', adminId)
    .eq('date', today);

  const attendanceRate = students?.length
    ? ((todayAttendance?.length || 0) / students.length * 100).toFixed(1)
    : 0;
  document.getElementById('attendanceRate').textContent = `${attendanceRate}%`;

  createAttendanceChart();
  createPaymentChart();
}

// Function to load plans
async function loadPlans() {
    const adminId = await getAdminId();
    if (!adminId) return;

    const { data: plans, error } = await supabase
        .from('plans')
        .select('*')
        .eq('mess_id', adminId)
        .order('created_at', { ascending: false });

    const tbody = document.getElementById('plansTableBody');
    tbody.innerHTML = '';

    if (plans && plans.length > 0) {
        plans.forEach(plan => {
            const row = `
                <tr>
                    <td class="px-4 py-3 text-sm text-gray-900">${plan.name}</td>
                    <td class="px-4 py-3 text-sm text-gray-900">${plan.duration_days}</td>
                    <td class="px-4 py-3 text-sm text-gray-900">₹${plan.price}</td>
                    <td class="px-4 py-3 text-sm">
                        <button onclick="editPlan('${plan.id}')" class="text-blue-600 hover:text-blue-800 mr-3">Edit</button>
                        <button onclick="deletePlan('${plan.id}')" class="text-red-600 hover:text-red-800">Delete</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-3 text-center text-gray-500">No plans found. Add one!</td></tr>';
    }
}

// Event listener for adding a plan
document.getElementById('addPlanBtn').addEventListener('click', async () => {
    const adminId = await getAdminId();
    if (!adminId) return;

    const formContent = `
        <form id="addPlanForm" class="space-y-4">
            <input type="text" id="planName" placeholder="Plan Name (e.g., Monthly Veg)" required class="w-full px-4 py-2 border rounded-lg">
            <input type="number" id="planDuration" placeholder="Duration in Days" required class="w-full px-4 py-2 border rounded-lg">
            <input type="number" id="planPrice" step="0.01" placeholder="Price (₹)" required class="w-full px-4 py-2 border rounded-lg">
            <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">Add Plan</button>
        </form>
    `;
    showModal('Add New Plan', formContent);

    document.getElementById('addPlanForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('planName').value;
        const duration = parseInt(document.getElementById('planDuration').value);
        const price = parseFloat(document.getElementById('planPrice').value);

        if (isNaN(duration) || duration <= 0) {
            alert('Duration must be a positive number.');
            return;
        }
        if (isNaN(price) || price < 0) {
            alert('Price must be a non-negative number.');
            return;
        }

        const { error } = await supabase.from('plans').insert({
            mess_id: adminId,
            name: name,
            duration_days: duration,
            price: price
        });

        if (error) {
            alert('Error adding plan: ' + error.message);
        } else {
            closeModal();
            loadPlans();
        }
    });
});

// Function to handle editing a plan
window.editPlan = async function(planId) {
    const { data: plan, error: fetchError } = await supabase
        .from('plans')
        .select('*')
        .eq('id', planId)
        .single();

    if (fetchError || !plan) {
        alert('Error fetching plan details: ' + (fetchError?.message || 'Plan not found'));
        return;
    }

    const formContent = `
        <form id="editPlanForm" class="space-y-4">
            <label class="block">Name</label>
            <input type="text" id="planName" value="${plan.name}" required class="w-full px-4 py-2 border rounded-lg">

            <label class="block">Duration (Days)</label>
            <input type="number" id="planDuration" value="${plan.duration_days}" required class="w-full px-4 py-2 border rounded-lg">

            <label class="block">Price (₹)</label>
            <input type="number" id="planPrice" step="0.01" value="${plan.price}" required class="w-full px-4 py-2 border rounded-lg">

            <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">Update Plan</button>
        </form>
    `;
    showModal(`Edit ${plan.name}`, formContent);

    document.getElementById('editPlanForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('planName').value;
        const duration = parseInt(document.getElementById('planDuration').value);
        const price = parseFloat(document.getElementById('planPrice').value);

        if (isNaN(duration) || duration <= 0) {
            alert('Duration must be a positive number.');
            return;
        }
         if (isNaN(price) || price < 0) {
            alert('Price must be a non-negative number.');
            return;
        }

        const { error } = await supabase
            .from('plans')
            .update({
                name: name,
                duration_days: duration,
                price: price
            })
            .eq('id', planId);

        if (error) {
            alert('Error updating plan: ' + error.message);
        } else {
            closeModal();
            loadPlans();
        }
    });
}

// Function to delete a plan
window.deletePlan = async function(planId) {
    if (!confirm('Are you sure you want to delete this plan? This cannot be undone.')) return;

    const { error } = await supabase
        .from('plans')
        .delete()
        .eq('id', planId);

    if (error) {
        alert('Error deleting plan: ' + error.message);
    } else {
        loadPlans();
    }
};
async function createAttendanceChart() {
  const adminId = await getAdminId();
  if (!adminId) return;

  const ctx = document.getElementById('attendanceChart');

  if (attendanceChart) {
    attendanceChart.destroy();
  }

  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const attendanceCounts = await Promise.all(
    last7Days.map(async (date) => {
      const { data } = await supabase
        .from('attendance')
        .select('*', { count: 'exact' })
        .eq('mess_id', adminId)
        .eq('date', date)
        .eq('status', 'Present');
      return data?.length || 0;
    })
  );

  attendanceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: last7Days.map(d => new Date(d).toLocaleDateString('en-US', { weekday: 'short' })),
      datasets: [{
        label: 'Daily Attendance',
        data: attendanceCounts,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4
      }]
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

async function createPaymentChart() {
    const adminId = await getAdminId();
    if (!adminId) return;

  const ctx = document.getElementById('paymentChart');

  if (paymentChart) {
    paymentChart.destroy();
  }

  // Fetch the correct columns for calculation
  const { data: payments } = await supabase
    .from('payments')
    .select('total_amount, paid_amount')
    .eq('mess_id', adminId);

  // The 'paid' amount is the sum of everything paid so far
  const paid = payments?.reduce((sum, p) => sum + parseFloat(p.paid_amount), 0) || 0;
  
  // The 'pending' amount is the total of all bills minus the amount that has been paid
  const totalBilled = payments?.reduce((sum, p) => sum + parseFloat(p.total_amount), 0) || 0;
  const pending = totalBilled - paid;

  paymentChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Paid', 'Pending'],
      datasets: [{
        label: 'Amount (₹)',
        data: [paid, pending],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(239, 68, 68, 0.8)'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
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

async function loadStudents() {
    const adminId = await getAdminId();
    if (!adminId) return;

    // First, fetch all students for the mess
    const { data: students, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('mess_id', adminId)
        .order('created_at', { ascending: false });

    if (studentError) {
        console.error('Error fetching students:', studentError);
        return;
    }
    
    // Second, fetch all plans for the mess
    const { data: plans } = await supabase
        .from('plans')
        .select('name, duration_days')
        .eq('mess_id', adminId);

    const tbody = document.getElementById('studentsTableBody');
    tbody.innerHTML = '';

    if (students && students.length > 0) {
        students.forEach(student => {
            let remainingDays = 'N/A';
            if (student.plan_start_date && student.plan_type && plans) {
                const plan = plans.find(p => p.name === student.plan_type);
                if (plan) {
                    const startDate = new Date(student.plan_start_date);
                    // Cloning date object to avoid mutation
                    const expiryDate = new Date(startDate.getTime());
                    expiryDate.setDate(expiryDate.getDate() + plan.duration_days);
                    
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // Normalize today's date to the start of the day

                    const diffTime = expiryDate - today;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    remainingDays = diffDays >= 0 ? `${diffDays} days` : 'Expired';
                }
            }

            const row = `
                <tr>
                    <td class="px-4 py-3 text-sm text-gray-900">${student.name}</td>
                    <td class="px-4 py-3 text-sm text-gray-900">${student.email}</td>
                    <td class="px-4 py-3 text-sm text-gray-900">${student.rfid_tag}</td>
                    <td class="px-4 py-3 text-sm text-gray-900">${student.room_no}</td>
                    <td class="px-4 py-3 text-sm text-gray-900">${student.plan_type}</td>
                    <td class="px-4 py-3 text-sm font-semibold ${remainingDays === 'Expired' ? 'text-red-500' : 'text-gray-900'}">${remainingDays}</td>
                    <td class="px-4 py-3 text-sm">
                        <span class="px-2 py-1 rounded-full text-xs ${student.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            ${student.status}
                        </span>
                    </td>
                    <td class="px-4 py-3 text-sm">
                        <button onclick="editStudent('${student.id}')" class="text-blue-600 hover:text-blue-800 mr-3">Edit</button>
                        <button onclick="deleteStudent('${student.id}')" class="text-red-600 hover:text-red-800">Delete</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-3 text-center text-gray-500">No students found</td></tr>';
    }
}

// Function to load mess info into the form
async function loadMessInfo() {
    const adminId = await getAdminId();
    if (!adminId) return;

    const { data: messInfo, error } = await supabase
        .from('mess_info')
        .select('*')
        .eq('mess_id', adminId)
        .single(); // Assuming one admin = one mess

    if (error && error.code !== 'PGRST116') { // PGRST116 = row not found, which is ok initially
        alert('Error loading mess info: ' + error.message);
        return;
    }

    // If no record exists yet (maybe for older admin accounts), fetch default name/email
    let defaultName = '';
    let defaultEmail = '';
    if (!messInfo) {
         const { data: profile } = await supabase
            .from('user_profiles')
            .select('full_name, (select email from auth.users where id = user_profiles.id limit 1) as email')
            .eq('id', adminId)
            .single();
        if (profile) {
            defaultName = profile.full_name;
            defaultEmail = profile.email;
        }
    }

    document.getElementById('messName').value = messInfo?.mess_name || defaultName || '';
    document.getElementById('messEmail').value = messInfo?.email || defaultEmail || '';
    document.getElementById('messPhone').value = messInfo?.phone || '';
    document.getElementById('messCollege').value = messInfo?.nearby_college || '';
    document.getElementById('messLocation').value = messInfo?.location_link || '';
}

// Function to save mess info
async function saveMessInfo(event) {
    event.preventDefault();
    const adminId = await getAdminId();
    if (!adminId) return;

    const saveBtn = document.getElementById('saveMessInfoBtn');
    const saveStatus = document.getElementById('messInfoSaveStatus');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    saveStatus.textContent = '';

    const updates = {
        mess_id: adminId, // Ensure mess_id is set
        mess_name: document.getElementById('messName').value,
        email: document.getElementById('messEmail').value,
        phone: document.getElementById('messPhone').value,
        nearby_college: document.getElementById('messCollege').value,
        location_link: document.getElementById('messLocation').value,
        updated_at: new Date() // Manually set updated_at
    };

    // Use upsert: update if exists, insert if not
    const { error } = await supabase
        .from('mess_info')
        .upsert(updates, { onConflict: 'mess_id' });

    if (error) {
        alert('Error saving mess info: ' + error.message);
        saveStatus.textContent = 'Error saving.';
        saveStatus.classList.replace('text-green-600', 'text-red-600');
    } else {
        saveStatus.textContent = 'Changes saved successfully!';
        saveStatus.classList.replace('text-red-600', 'text-green-600');
        setTimeout(() => { saveStatus.textContent = ''; }, 3000);
    }
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Changes';
}

// Attach listener to the form
document.getElementById('messInfoForm').addEventListener('submit', saveMessInfo);

async function loadAttendance() {
    const adminId = await getAdminId();
    if (!adminId) return;

  const { data: attendance } = await supabase
    .from('attendance')
    .select(`
      *,
      students (name)
    `)
    .eq('mess_id', adminId)
    .order('marked_at', { ascending: false }) // Order by time marked is better
    .limit(100);

  const tbody = document.getElementById('attendanceTableBody');
  tbody.innerHTML = '';

  if (attendance && attendance.length > 0) {
    attendance.forEach(record => {
      // Corrected: Use case-insensitive check for status color
      const isPresent = record.status.toUpperCase() === 'PRESENT';
      const statusClass = isPresent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';

      const row = `
        <tr>
          <td class="px-4 py-3 text-sm text-gray-900">${record.students?.name || 'Unknown'}</td>
          <td class="px-4 py-3 text-sm text-gray-900">${new Date(record.date).toLocaleDateString()}</td>
          <td class="px-4 py-3 text-sm text-gray-900">${record.meal || 'N/A'}</td>
          <td class="px-4 py-3 text-sm">
            <span class="px-2 py-1 rounded-full text-xs ${statusClass}">
              ${record.status}
            </span>
          </td>
          <td class="px-4 py-3 text-sm text-gray-900">${new Date(record.marked_at).toLocaleString()}</td>
        </tr>
      `;
      tbody.innerHTML += row;
    });
  } else {
    // Corrected colspan for the empty state message
    tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-3 text-center text-gray-500">No attendance records found</td></tr>';
  }
}

async function loadPayments() {
    const adminId = await getAdminId();
    if (!adminId) return;

  const { data: payments } = await supabase
    .from('payments')
    .select(`
      *,
      students (name)
    `)
    .eq('mess_id', adminId)
    .order('due_date', { ascending: false });

  const tbody = document.getElementById('paymentsTableBody');
  tbody.innerHTML = '';

  if (payments && payments.length > 0) {
    payments.forEach(payment => {
      const row = `
        <tr>
          <td class="px-4 py-3 text-sm text-gray-900">${payment.students?.name || 'Unknown'}</td>
          <td class="px-4 py-3 text-sm text-gray-900">₹${payment.amount}</td>
          <td class="px-4 py-3 text-sm text-gray-900">${new Date(payment.due_date).toLocaleDateString()}</td>
          <td class="px-4 py-3 text-sm">
            <span class="px-2 py-1 rounded-full text-xs ${payment.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
              ${payment.status}
            </span>
          </td>
          <td class="px-4 py-3 text-sm">
            ${payment.status === 'Pending' ? `<button onclick="markAsPaid('${payment.id}')" class="text-green-600 hover:text-green-800 mr-3">Mark Paid</button>` : ''}
            <button onclick="deletePayment('${payment.id}')" class="text-red-600 hover:text-red-800">Delete</button>
          </td>
        </tr>
      `;
      tbody.innerHTML += row;
    });
  } else {
    tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-3 text-center text-gray-500">No payment records found</td></tr>';
  }
}

async function loadMenu() {
    const adminId = await getAdminId();
    if (!adminId) return;

  const { data: menuItems } = await supabase
    .from('menu')
    .select('*')
    .eq('mess_id', adminId)
    .order('date', { ascending: false });

  const tbody = document.getElementById('menuTableBody');
  tbody.innerHTML = '';

  if (menuItems && menuItems.length > 0) {
    menuItems.forEach(menu => {
      const row = `
        <tr>
          <td class="px-4 py-3 text-sm text-gray-900">${new Date(menu.date).toLocaleDateString()}</td>
          <td class="px-4 py-3 text-sm text-gray-900">${menu.breakfast}</td>
          <td class="px-4 py-3 text-sm text-gray-900">${menu.lunch}</td>
          <td class="px-4 py-3 text-sm text-gray-900">${menu.dinner}</td>
          <td class="px-4 py-3 text-sm">
            <button onclick="editMenu('${menu.id}')" class="text-blue-600 hover:text-blue-800 mr-3">Edit</button>
            <button onclick="deleteMenu('${menu.id}')" class="text-red-600 hover:text-red-800">Delete</button>
          </td>
        </tr>
      `;
      tbody.innerHTML += row;
    });
  } else {
    tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-3 text-center text-gray-500">No menu items found</td></tr>';
  }
}

window.markAsPaid = async function(paymentId) {
  if (!confirm('Mark this payment as paid?')) return;
  const { error } = await supabase.from('payments').update({ status: 'Paid', paid_on: new Date().toISOString().split('T')[0] }).eq('id', paymentId);
  if (error) { alert('Error updating payment: ' + error.message); } else { loadPayments(); }
};

window.deleteStudent = async function(studentId) {
  if (!confirm('Are you sure you want to delete this student?')) return;
  const { error } = await supabase.from('students').delete().eq('id', studentId);
  if (error) { alert('Error deleting student: ' + error.message); } else { loadStudents(); }
};

window.deletePayment = async function(paymentId) {
  if (!confirm('Are you sure you want to delete this payment?')) return;
  const { error } = await supabase.from('payments').delete().eq('id', paymentId);
  if (error) { alert('Error deleting payment: ' + error.message); } else { loadPayments(); }
};

window.deleteMenu = async function(menuId) {
  if (!confirm('Are you sure you want to delete this menu?')) return;
  const { error } = await supabase.from('menu').delete().eq('id', menuId);
  if (error) { alert('Error deleting menu: ' + error.message); } else { loadMenu(); }
};
async function markAbsenteesForPreviousMeal() {
    const adminId = await getAdminId();
    if (!adminId) return;

    const statusEl = document.getElementById('absenteeStatus');
    const btn = document.getElementById('markAbsenteesBtn');
    btn.disabled = true;
    statusEl.textContent = 'Processing...';

    const previousMeal = getPreviousMealType();
    if (!previousMeal) {
        statusEl.textContent = 'No previous meal to mark for today yet.';
        setTimeout(() => { statusEl.textContent = ''; btn.disabled = false; }, 3000);
        return;
    }

    const today = new Date().toISOString().split('T')[0];

    try {
        // 1. Get all active students for this mess
        const { data: students, error: studentError } = await supabase
            .from('students')
            .select('id')
            .eq('mess_id', adminId)
            .eq('status', 'Active'); // Only consider active students
        if (studentError) throw new Error('Could not fetch students.');
        if (!students || students.length === 0) throw new Error('No active students found.');

        // 2. Get today's attendance records for the PREVIOUS meal
        const { data: presentAttendance, error: attendanceError } = await supabase
            .from('attendance')
            .select('student_id')
            .eq('mess_id', adminId)
            .eq('date', today)
            .eq('meal', previousMeal);
        if (attendanceError) throw new Error('Could not fetch attendance records.');

        const presentStudentIds = new Set(presentAttendance.map(a => a.student_id));

        // 3. Find students who were NOT present
        const absentStudents = students.filter(s => !presentStudentIds.has(s.id));

        if (absentStudents.length === 0) {
             statusEl.textContent = `All active students were present for ${previousMeal}.`;
             setTimeout(() => { statusEl.textContent = ''; btn.disabled = false; }, 3000);
             return;
        }

        // 4. Prepare records to insert
        const recordsToInsert = absentStudents.map(student => ({
            student_id: student.id,
            mess_id: adminId,
            date: today,
            meal: previousMeal,
            status: 'ABSENT', // Mark as ABSENT
            marked_at: new Date() // Record when the admin marked them absent
        }));

        // 5. Insert absent records
        const { error: insertError } = await supabase
            .from('attendance')
            .insert(recordsToInsert);
        if (insertError) {
             // Handle potential race condition if a record was added manually just now
             if (insertError.code === '23505') { // unique_violation
                statusEl.textContent = `Some students were already marked. Re-run if needed.`;
             } else {
                throw new Error('Could not mark absentees.');
             }
        } else {
            statusEl.textContent = `Marked ${recordsToInsert.length} student(s) as absent for ${previousMeal}.`;
        }

         // Refresh the attendance view
        loadAttendance();

    } catch (error) {
        console.error("Error marking absentees:", error);
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.classList.add('text-red-500');
    } finally {
         // Re-enable button after a delay
         setTimeout(() => {
             statusEl.textContent = '';
             statusEl.classList.remove('text-red-500');
             btn.disabled = false;
         }, 5000);
    }
}

// --- MODAL AND FORM LOGIC ---
function showModal(title, content) {
    const modalContainer = document.getElementById('modalContainer');
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-gray-800">${title}</h2>
          <button onclick="closeModal()" class="text-gray-600 hover:text-gray-900 text-3xl">&times;</button>
        </div>
        <div>${content}</div>
      </div>
    `;
    modalContainer.appendChild(modal);
}
  
window.closeModal = function() {
    const modalContainer = document.getElementById('modalContainer');
    modalContainer.innerHTML = '';
}
  
document.getElementById('addStudentBtn').addEventListener('click', async () => {
    const adminId = await getAdminId();
    if (!adminId) return;
    const formContent = `<form id="addStudentForm" class="space-y-4"><input type="text" id="studentName" placeholder="Full Name" required class="w-full px-4 py-2 border rounded-lg"><input type="email" id="studentEmail" placeholder="Email" required class="w-full px-4 py-2 border rounded-lg"><input type="text" id="studentMobile" placeholder="Mobile" required class="w-full px-4 py-2 border rounded-lg"><input type="text" id="studentRfid" placeholder="RFID Tag" required class="w-full px-4 py-2 border rounded-lg"><input type="text" id="studentRoom" placeholder="Room No" required class="w-full px-4 py-2 border rounded-lg"><select id="studentPlan" class="w-full px-4 py-2 border rounded-lg"><option value="Monthly">Monthly</option><option value="Weekly">Weekly</option></select><button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">Add Student</button></form>`;
    showModal('Add New Student', formContent);
    document.getElementById('addStudentForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error } = await supabase.from('students').insert({ name: document.getElementById('studentName').value, email: document.getElementById('studentEmail').value, mobile: document.getElementById('studentMobile').value, rfid_tag: document.getElementById('studentRfid').value, room_no: document.getElementById('studentRoom').value, plan_type: document.getElementById('studentPlan').value, status: 'Active', mess_id: adminId });
      if (error) { alert('Error adding student: ' + error.message); } else { closeModal(); loadStudents(); loadDashboard(); }
    });
});
  
document.getElementById('addPaymentBtn').addEventListener('click', async () => {
    const adminId = await getAdminId();
    if (!adminId) return;

    const { data: students } = await supabase.from('students').select('id, name, plan_type').eq('mess_id', adminId);
    const { data: plans } = await supabase.from('plans').select('name, price').eq('mess_id', adminId);

    const studentOptions = students.map(s => `<option value="${s.id}" data-plan="${s.plan_type}">${s.name}</option>`).join('');

    const formContent = `
        <form id="addPaymentForm" class="space-y-4">
            <div>
                <label class="block">Student</label>
                <select id="paymentStudent" class="w-full px-4 py-2 border rounded-lg">${studentOptions}</select>
            </div>
            <div>
                <label class="block">Total Bill Amount (₹)</label>
                <input type="number" id="totalAmount" step="0.01" placeholder="e.g., 1500" required class="w-full px-4 py-2 border rounded-lg">
            </div>
            <div>
                <label class="block">Payment Type</label>
                <select id="paymentType" class="w-full px-4 py-2 border rounded-lg">
                    <option value="Full">Full Payment</option>
                    <option value="Installment">Installment</option>
                </select>
            </div>
            <div id="amountPaidField" class="hidden">
                <label class="block">Amount Being Paid Now (₹)</label>
                <input type="number" id="amountPaid" step="0.01" placeholder="e.g., 500" class="w-full px-4 py-2 border rounded-lg">
            </div>
             <div>
                <label class="block">Due Date</label>
                <input type="date" id="paymentDueDate" required class="w-full px-4 py-2 border rounded-lg">
            </div>
            <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">Create Bill</button>
        </form>
    `;
    showModal('Create New Bill', formContent);

    // --- Add dynamic logic to the new form ---
    const studentSelect = document.getElementById('paymentStudent');
    const totalAmountInput = document.getElementById('totalAmount');
    const paymentTypeSelect = document.getElementById('paymentType');
    const amountPaidField = document.getElementById('amountPaidField');
    const amountPaidInput = document.getElementById('amountPaid');

    // Auto-fill total amount based on student's plan
    studentSelect.addEventListener('change', () => {
        const selectedOption = studentSelect.options[studentSelect.selectedIndex];
        const planName = selectedOption.dataset.plan;
        const plan = plans.find(p => p.name === planName);
        if (plan) {
            totalAmountInput.value = plan.price;
        }
    });
    studentSelect.dispatchEvent(new Event('change')); // Trigger on open

    // Show/hide installment field
    paymentTypeSelect.addEventListener('change', () => {
        if (paymentTypeSelect.value === 'Installment') {
            amountPaidField.classList.remove('hidden');
            amountPaidInput.required = true;
        } else {
            amountPaidField.classList.add('hidden');
            amountPaidInput.required = false;
        }
    });

    // Handle form submission
    document.getElementById('addPaymentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const studentId = document.getElementById('paymentStudent').value;
        const totalAmount = parseFloat(totalAmountInput.value);
        const paymentType = paymentTypeSelect.value;
        const dueDate = document.getElementById('paymentDueDate').value;
        let amountPaid = 0;
        let status = 'Pending';

        if (paymentType === 'Full') {
            amountPaid = totalAmount;
            status = 'Paid';
        } else { // Installment
            amountPaid = parseFloat(amountPaidInput.value);
            if (isNaN(amountPaid) || amountPaid <= 0) {
                alert('Please enter a valid amount paid.');
                return;
            }
            if (amountPaid >= totalAmount) {
                status = 'Paid';
            } else {
                status = 'Partially Paid';
            }
        }

        const { error } = await supabase.from('payments').insert({
            student_id: studentId,
            total_amount: totalAmount,
            paid_amount: amountPaid,
            last_paid_transaction: amountPaid, // Log this specific transaction
            status: status,
            due_date: dueDate,
            mess_id: adminId,
            paid_on: (status === 'Paid' || status === 'Partially Paid') ? new Date().toISOString() : null
        });

        if (error) {
            alert('Error creating payment record: ' + error.message);
        } else {
            closeModal();
            loadPayments();
            loadDashboard();
        }
    });
});

document.getElementById('addMenuBtn').addEventListener('click', async () => {
    const adminId = await getAdminId();
    if (!adminId) return;
    const formContent = `<form id="addMenuForm" class="space-y-4"><input type="date" id="menuDate" required class="w-full px-4 py-2 border rounded-lg"><input type="text" id="menuBreakfast" placeholder="Breakfast" required class="w-full px-4 py-2 border rounded-lg"><input type="text" id="menuLunch" placeholder="Lunch" required class="w-full px-4 py-2 border rounded-lg"><input type="text" id="menuDinner" placeholder="Dinner" required class="w-full px-4 py-2 border rounded-lg"><button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">Add Menu</button></form>`;
    showModal('Add New Menu', formContent);
    document.getElementById('addMenuForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error } = await supabase.from('menu').insert({ date: document.getElementById('menuDate').value, breakfast: document.getElementById('menuBreakfast').value, lunch: document.getElementById('menuLunch').value, dinner: document.getElementById('menuDinner').value, mess_id: adminId });
      if (error) { alert('Error adding menu: ' + error.message); } else { closeModal(); loadMenu(); }
    });
});

window.editStudent = async function(studentId) {
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('*')
    .eq('id', studentId)
    .single();
  if (studentError) { alert('Error fetching student details: ' + studentError.message); return; }

  const { data: parents } = await supabase.from('user_profiles').select('id, full_name').eq('role', 'parent');
  const parentOptions = parents ? parents.map(p => `<option value="${p.id}" ${student.parent_id === p.id ? 'selected' : ''}>${p.full_name || p.id}</option>`).join('') : '';

  const formContent = `
    <form id="editStudentForm" class="space-y-4">
      <label class="block">Name</label><input type="text" id="studentName" value="${student.name}" required class="w-full px-4 py-2 border rounded-lg">
      <label class="block">Email</label><input type="email" id="studentEmail" value="${student.email}" required class="w-full px-4 py-2 border rounded-lg">

      <label class="block">Plan Start Date (Set to today to activate/recharge)</label>
      <input type="date" id="planStartDate" value="${student.plan_start_date || ''}" class="w-full px-4 py-2 border rounded-lg">

      <label class="block">Link Parent Account</label><select id="studentParentId" class="w-full px-4 py-2 border rounded-lg"><option value="">No Parent</option>${parentOptions}</select>
      <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">Update Student</button>
    </form>
  `;
  showModal(`Edit ${student.name}`, formContent);

  document.getElementById('editStudentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('students').update({
        name: document.getElementById('studentName').value,
        email: document.getElementById('studentEmail').value,
        plan_start_date: document.getElementById('planStartDate').value || null,
        parent_id: document.getElementById('studentParentId').value || null
    }).eq('id', studentId);
    if (error) { alert('Error updating student: ' + error.message); } else { closeModal(); loadStudents(); }
  });
};

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
});

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  setupSidebarToggle();
  setupNavigation();
  loadDashboard();
  document.getElementById('markAbsenteesBtn').addEventListener('click', markAbsenteesForPreviousMeal);
});