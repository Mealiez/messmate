import { supabase } from '../supabaseConfig.js';

let attendanceChart, paymentChart;

// Helper to get the current admin's user ID
async function getAdminId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user ? user.id : null;
}

// --- NEW: Feature flag & Plan Logic ---
function applyPlanFeatures(plan, enabledFeatures = []) {
  console.log("Applying features for plan:", plan, "Enabled modules:", enabledFeatures);

  const navLinks = document.querySelectorAll('.nav-link');
  
  navLinks.forEach(link => {
    const section = link.dataset.section;
    const isReportLink = link.getAttribute('href') && link.getAttribute('href').includes('report.html');
    const isLogout = link.id === 'logoutBtn' || (link.innerText && link.innerText.includes('Logout'));

    // Base default visibility (Free plan shows minimum)
    let isVisible = true;
    if (plan === 'free' || !plan) {
      if (section !== 'messInfo' && section !== 'plans' && !isLogout) {
         isVisible = false;
      }
    } else if (plan === 'starter') {
      if (isReportLink) isVisible = false;
    }

    // Advanced Feature Toggles (Overrides based on database)
    if (section === 'students' && !enabledFeatures.includes('student_management')) isVisible = false;
    if (section === 'payments' && !enabledFeatures.includes('billing')) isVisible = false;
    if (section === 'menu' && !enabledFeatures.includes('menu_management')) isVisible = false;
    if (section === 'scan' && !enabledFeatures.includes('qr_attendance')) isVisible = false;
    if (section === 'mealRequests' && !enabledFeatures.includes('meal_requests')) isVisible = false;

    if (isVisible) {
      link.classList.remove('hidden');
    } else {
      link.classList.add('hidden');
    }
  });

  // Force Redirect for Free Plan if on a restricted page
  if (plan === 'free' || !plan) {
      const dashboardSection = document.getElementById('dashboardSection');
      if (dashboardSection && !dashboardSection.classList.contains('hidden')) {
          dashboardSection.classList.add('hidden');
          const messInfoSection = document.getElementById('messInfoSection');
          if (messInfoSection) messInfoSection.classList.remove('hidden');
          const pageTitle = document.getElementById('pageTitle');
          if(pageTitle) pageTitle.textContent = "Mess Info";
          if (typeof loadMessInfo === 'function') loadMessInfo();
      }
  }
}

// --- UPDATED: checkAuth Function ---
async function checkAuth() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role, subscription_plan, payment_status, tenant_id')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !profile || profile.role !== 'admin') {
    alert('Access denied. Admin privileges required.');
    await supabase.auth.signOut();
    window.location.href = 'login.html';
    return;
  }

  // ── Payment Wall ───────────────────────────────────────────
  // If payment not confirmed (custom plans), block dashboard access
  if (profile.payment_status !== 'paid') {
    window.location.href = 'contact.html';
    return;
  }

  // ── Feature Resolution ─────────────────────────────────────
  // Priority: plan_features table (plan-level) → fallback to defaults
  const currentPlan = profile.subscription_plan || 'free';
  let enabledFeatures = [];

  const { data: planFeatures } = await supabase
    .from('plan_features')
    .select('feature_id')
    .eq('plan_name', currentPlan);

  if (planFeatures && planFeatures.length > 0) {
    enabledFeatures = planFeatures.map(f => f.feature_id);
  }

  // Apply feature visibility
  applyPlanFeatures(currentPlan, enabledFeatures);
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

// Helper to format meal name to Title case (Breakfast, Lunch, Dinner) for meal_requests table
function formatMealName(meal) {
    if (!meal) return null;
    return meal.charAt(0).toUpperCase() + meal.slice(1).toLowerCase();
}

async function onScanSuccess(decodedText, decodedResult) {
    const studentId = decodedText;
    const scanResultEl = document.getElementById('scanResult');
    scanResultEl.innerHTML = '<div class="text-gray-500 font-semibold text-lg">Processing...</div>';

    if (html5QrcodeScanner && html5QrcodeScanner.getState() === 2) {
        html5QrcodeScanner.pause();
    }

    try {
        const adminId = await getAdminId();
        if (!adminId) throw new Error("Could not verify admin.");

        const meal = getMealTypeByTime();
        if (!meal) throw new Error('No meal service is active at this time.');

        // 1. Get Admin Profile for tenant_id (needed for mealiez lookup)
        const { data: adminProfile } = await supabase
            .from('user_profiles')
            .select('tenant_id')
            .eq('id', adminId)
            .single();

        // 2. Try Standard Students First
        let { data: student, error: studentError } = await supabase
            .from('students')
            .select('id, name, email, mobile')
            .eq('id', studentId)
            .eq('mess_id', adminId)
            .maybeSingle();

        // 3. Fallback to Mealiez Students if not found
        if (!student && adminProfile?.tenant_id) {
            const { data: mealiez, error: mealiezError } = await supabase
                .from('student_mealiez')
                .select('id, name, email, mobile_number')
                .eq('id', studentId)
                .eq('tenant_id', adminProfile.tenant_id)
                .maybeSingle();
            
            if (mealiez) {
                student = {
                    ...mealiez,
                    mobile: mealiez.mobile_number
                };
            }
        }

        if (!student) throw new Error('Student not found or not enrolled in this mess.');

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
            mess_id: adminId,
            tenant_id: adminProfile?.tenant_id
        });

        if (insertError) {
            console.error("DETAILED SUPABASE ERROR:", insertError);
            throw new Error('Error saving attendance.');
        }

        // --- AUTO-FULFILL MEAL REQUEST ---
        try {
            await supabase
                .from('meal_requests')
                .update({ status: 'Fulfilled', updated_at: new Date() })
                .eq('student_id', studentId)
                .eq('date', today)
                .eq('meal_type', formatMealName(meal))
                .eq('status', 'Requested');
        } catch (mealErr) {
            console.warn("Auto-fulfillment failed (non-critical):", mealErr);
        }

        // 4. DISPLAY RICH SUCCESS MESSAGE
        scanResultEl.innerHTML = `
            <div class="bg-green-50 border border-green-200 rounded-lg p-4 shadow-sm animate-pulse">
                <div class="text-green-800 font-bold text-xl mb-1">
                    Success! Marked for ${meal}
                </div>
                <div class="bg-white rounded p-3 flex flex-col items-center">
                    <p class="text-gray-900 font-black text-2xl">${student.name}</p>
                    <div class="flex gap-4 mt-2 text-sm text-gray-600">
                        <p class="flex items-center"><svg class="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>${student.mobile || 'N/A'}</p>
                        <p class="flex items-center"><svg class="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>${student.email || 'N/A'}</p>
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        scanResultEl.innerHTML = `
            <div class="bg-red-50 border border-red-200 text-red-700 font-bold p-3 rounded-lg">
                Error: ${error.message}
            </div>
        `;
    } finally {
        setTimeout(() => {
            if (html5QrcodeScanner && html5QrcodeScanner.getState() === 3) {
                html5QrcodeScanner.resume();
                scanResultEl.innerHTML = '';
            }
        }, 5000); // 5 seconds display for easier reading
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
        case 'mealRequests':
          loadMealRequests();
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
                    const expiryDate = new Date(startDate.getTime());
                    expiryDate.setDate(expiryDate.getDate() + plan.duration_days);
                    
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    const diffTime = expiryDate - today;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    remainingDays = diffDays >= 0 ? `${diffDays} days` : 'Expired';
                }
            }

            const row = `
                <tr>
                    <td class="px-4 py-3 text-sm text-gray-900">${student.name}</td>
                    <td class="px-4 py-3 text-sm text-gray-900">${student.email}</td>
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
        tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-3 text-center text-gray-500">No students found</td></tr>';
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

// --- UPDATED: Payment History Table (Cleaner) ---
async function loadPayments() {
    const adminId = await getAdminId();
    if (!adminId) return;

    const tbody = document.getElementById('paymentsTableBody');
    if(tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Loading...</td></tr>';

    const { data: payments, error } = await supabase
        .from('payments')
        .select(`*, students (name)`)
        .eq('mess_id', adminId)
        .order('created_at', { ascending: false });

    if (error || !tbody) return;

    tbody.innerHTML = '';

    if (payments && payments.length > 0) {
        payments.forEach(payment => {
            const total = parseFloat(payment.total_amount || 0);
            const paid = parseFloat(payment.paid_amount || 0);
            
            let displayAmount = '';
            let statusBadge = '';
            let rowColor = '';

            // Logic: Differentiate between BILL (Debt) and PAYMENT (Credit)
            if (total > 0 && paid === 0) {
                // This is a BILL (e.g., Monthly Fee auto-generated)
                displayAmount = `₹${total}`;
                statusBadge = `<span class="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">Bill Generated</span>`;
                rowColor = 'bg-white'; 
            } 
            else if (total === 0 && paid > 0) {
                // This is a PAYMENT (Money Received)
                displayAmount = `<span class="text-green-600 font-bold">+ ₹${paid}</span>`;
                statusBadge = `<span class="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Payment Received</span>`;
                rowColor = 'bg-green-50';
            }
            else {
                // Fallback for older/mixed records
                displayAmount = `₹${total}`; 
                statusBadge = `<span class="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">${payment.status}</span>`;
            }

            const row = `
                <tr class="${rowColor} hover:bg-gray-50 border-b">
                    <td class="px-4 py-3 text-sm text-gray-900">
                        <div class="font-medium">${payment.students?.name || 'Unknown'}</div>
                        <div class="text-xs text-gray-500">${new Date(payment.created_at).toLocaleTimeString()}</div>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-900 font-medium">${displayAmount}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${new Date(payment.due_date).toLocaleDateString()}</td>
                    <td class="px-4 py-3 text-sm">${statusBadge}</td>
                    <td class="px-4 py-3 text-sm text-right">
                        <button onclick="deletePayment('${payment.id}')" class="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1 rounded hover:bg-red-50 transition">
                            Delete
                        </button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-500 italic">No transaction history found.</td></tr>';
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
        const { data: adminProfile } = await supabase
            .from('user_profiles')
            .select('tenant_id')
            .eq('id', adminId)
            .single();

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
            tenant_id: adminProfile?.tenant_id,
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
            
            // --- NEW: AUTO-CANCEL MEAL REQUESTS FOR ABSENTEES ---
            try {
                const absentIds = absentStudents.map(s => s.id);
                await supabase
                    .from('meal_requests')
                    .update({ status: 'Cancelled', updated_at: new Date() })
                    .in('student_id', absentIds)
                    .eq('date', today)
                    .eq('meal_type', formatMealName(previousMeal))
                    .eq('status', 'Requested');
            } catch (mealErr) {
                console.warn("Auto-cancellation of meal requests failed (non-critical):", mealErr);
            }
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
    // REMOVED RFID INPUT FROM FORM CONTENT
    const formContent = `<form id="addStudentForm" class="space-y-4"><input type="text" id="studentName" placeholder="Full Name" required class="w-full px-4 py-2 border rounded-lg"><input type="email" id="studentEmail" placeholder="Email" required class="w-full px-4 py-2 border rounded-lg"><input type="text" id="studentMobile" placeholder="Mobile" required class="w-full px-4 py-2 border rounded-lg"><input type="text" id="studentRoom" placeholder="Room No" required class="w-full px-4 py-2 border rounded-lg"><select id="studentPlan" class="w-full px-4 py-2 border rounded-lg"><option value="Monthly">Monthly</option><option value="Weekly">Weekly</option></select><button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">Add Student</button></form>`;
    showModal('Add New Student', formContent);
    document.getElementById('addStudentForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      // REMOVED RFID FROM INSERT
      const { error } = await supabase.from('students').insert({ name: document.getElementById('studentName').value, email: document.getElementById('studentEmail').value, mobile: document.getElementById('studentMobile').value, room_no: document.getElementById('studentRoom').value, plan_type: document.getElementById('studentPlan').value, status: 'Active', mess_id: adminId });
      if (error) { alert('Error adding student: ' + error.message); } else { closeModal(); loadStudents(); loadDashboard(); }
    });
});
  
// --- FIXED: Add Payment Logic ---
// --- FIXED: Add Payment (Collect Money Only) ---
document.getElementById('addPaymentBtn')?.addEventListener('click', async () => {
    const adminId = await getAdminId();
    if (!adminId) return;

    // 1. Fetch Balances
    const { data: students } = await supabase.from('students').select('id, name').eq('mess_id', adminId);
    const { data: payments } = await supabase.from('payments').select('student_id, total_amount, paid_amount').eq('mess_id', adminId);

    const studentBalances = {};
    students.forEach(s => studentBalances[s.id] = { name: s.name, pending: 0 });
    
    payments.forEach(p => {
        if (studentBalances[p.student_id]) {
            // Calculate: Sum(Bill) - Sum(Paid)
            const pending = parseFloat(p.total_amount || 0) - parseFloat(p.paid_amount || 0);
            studentBalances[p.student_id].pending += pending;
        }
    });

    const studentOptions = students.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    const formContent = `
        <form id="addPaymentForm" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700">Select Student</label>
                <select id="paymentStudent" class="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 bg-white">${studentOptions}</select>
                <p id="balanceHint" class="text-xs mt-1 font-bold"></p>
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700">Payment Type</label>
                <select id="paymentType" class="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 bg-white">
                    <option value="Full">Full Payment (Clears Dues)</option>
                    <option value="Installment">Installment / Partial Payment</option>
                </select>
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700">Bill Amount (Pending)</label>
                <input type="number" id="totalAmount" step="0.01" class="w-full px-4 py-2 border rounded-lg bg-gray-100 text-gray-600" readonly>
            </div>

            <div id="payAmountField" class="hidden">
                <label class="block text-sm font-medium text-gray-700">Amount Collecting Now (₹)</label>
                <input type="number" id="amountPaid" step="0.01" class="w-full px-4 py-2 border rounded-lg" placeholder="Enter amount">
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700">Date</label>
                <input type="date" id="paymentDueDate" required class="w-full px-4 py-2 border rounded-lg">
            </div>
            
            <div id="blockedMessage" class="hidden bg-green-100 text-green-800 p-4 rounded-lg text-center font-bold">
                Student has no pending dues!
            </div>

            <button type="submit" id="submitPaymentBtn" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 mt-2">Save Record</button>
        </form>
    `;
    showModal('Add Payment', formContent);

    // Logic Elements
    const studentSelect = document.getElementById('paymentStudent');
    const typeSelect = document.getElementById('paymentType');
    const totalInput = document.getElementById('totalAmount'); // Read-only pending display
    const paidInput = document.getElementById('amountPaid');
    const payField = document.getElementById('payAmountField');
    const balanceHint = document.getElementById('balanceHint');
    const blockedMessage = document.getElementById('blockedMessage');
    const submitBtn = document.getElementById('submitPaymentBtn');
    
    document.getElementById('paymentDueDate').valueAsDate = new Date();

    function updateUI() {
        const sId = studentSelect.value;
        const balance = studentBalances[sId]?.pending || 0;
        const type = typeSelect.value;

        // 1. Display Pending Balance
        totalInput.value = balance.toFixed(2);

        if (balance <= 0.9) { // Buffer for float issues
            balanceHint.textContent = "Status: Fully Paid";
            balanceHint.className = "text-xs mt-1 font-bold text-green-600";
            
            // Block payments if fully paid
            blockedMessage.classList.remove('hidden');
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
            // Hide input fields to prevent confusion
            totalInput.parentElement.classList.add('hidden');
            payField.classList.add('hidden');
        } else {
            balanceHint.textContent = `Pending Dues: ₹${balance.toFixed(0)}`;
            balanceHint.className = "text-xs mt-1 font-bold text-red-600";
            
            // Enable payments
            blockedMessage.classList.add('hidden');
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            totalInput.parentElement.classList.remove('hidden');

            // 2. Handle Payment Type UI
            if (type === 'Installment') {
                payField.classList.remove('hidden');
                paidInput.required = true;
            } else {
                // Full Payment
                payField.classList.add('hidden');
                paidInput.required = false;
            }
        }
    }

    studentSelect.addEventListener('change', updateUI);
    typeSelect.addEventListener('change', updateUI);
    if(studentSelect.options.length > 0) updateUI();

    // Handle Submission
    document.getElementById('addPaymentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const sId = studentSelect.value;
        const balance = studentBalances[sId]?.pending || 0;
        let amountToPay = 0;
        
        if (typeSelect.value === 'Full') {
            amountToPay = balance; // Pay exactly what is owed
        } else {
            amountToPay = parseFloat(paidInput.value); // Pay manual amount
        }

        if (amountToPay <= 0) {
            alert("Payment amount must be valid.");
            return;
        }
        if (amountToPay > balance + 10) { // Small buffer for tipping/overpay
             if(!confirm("Amount is greater than pending dues. Continue?")) return;
        }

        // LOGIC: To reduce pending balance, we insert a record with:
        // Total_Amount = 0 (No new debt)
        // Paid_Amount = X (Paying off old debt)
        const { error } = await supabase.from('payments').insert({
            student_id: sId,
            total_amount: 0, 
            paid_amount: amountToPay,
            last_paid_transaction: amountToPay,
            status: 'Paid',
            due_date: document.getElementById('paymentDueDate').value,
            mess_id: adminId,
            paid_on: new Date().toISOString()
        });

        if (error) {
            alert('Error: ' + error.message);
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

// --- UPDATED: Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth(); // This now triggers applyPlanFeatures
  
  // Initialize UI elements
  if (typeof setupSidebarToggle === 'function') setupSidebarToggle();
  if (typeof setupNavigation === 'function') setupNavigation();
  
  // Only load dashboard if visible (Pro/Starter), otherwise checkAuth handled the redirect
  const dashboardSection = document.getElementById('dashboardSection');
  if (dashboardSection && !dashboardSection.classList.contains('hidden')) {
      if (typeof loadDashboard === 'function') loadDashboard();
  }
  
  // Helper for the 'Mark Absentees' button if it exists
  const markBtn = document.getElementById('markAbsenteesBtn');
  if (markBtn && typeof markAbsenteesForPreviousMeal === 'function') {
      markBtn.addEventListener('click', markAbsenteesForPreviousMeal);
  }
});

// --- FIXED: Student Ledger (Payment Status) ---
document.getElementById('paymentStatusBtn')?.addEventListener('click', async () => {
  const adminId = await getAdminId();
  if (!adminId) return;

  // 1. Show Loading
  showModal('Student Payment Status', '<div class="text-center py-8"><p class="text-gray-600 text-lg animate-pulse">Calculating balances...</p></div>');

  try {
    // 2. Fetch Data
    const { data: students, error: stError } = await supabase
      .from('students')
      .select('id, name, room_no')
      .eq('mess_id', adminId);

    const { data: payments, error: payError } = await supabase
      .from('payments')
      .select('student_id, total_amount, paid_amount')
      .eq('mess_id', adminId);

    if (stError || payError) {
      throw new Error(stError?.message || payError?.message || "Database error");
    }

    // 3. Aggregate Data
    const ledger = {};

    // Initialize ledger for all students
    (students || []).forEach(s => {
      ledger[s.id] = {
        name: s.name,
        room: s.room_no || 'N/A',
        totalBilled: 0,
        totalPaid: 0
      };
    });

    // Sum up payments
    (payments || []).forEach(p => {
      if (ledger[p.student_id]) {
        ledger[p.student_id].totalBilled += parseFloat(p.total_amount || 0);
        ledger[p.student_id].totalPaid += parseFloat(p.paid_amount || 0);
      }
    });

    // 4. Build Table HTML
    let tableHtml = `
      <div class="overflow-x-auto max-h-[60vh] border rounded-lg">
        <table class="w-full text-left border-collapse">
          <thead class="sticky top-0 bg-gray-100 z-10 shadow-sm">
            <tr>
              <th class="p-3 font-semibold text-gray-700 text-sm">Student</th>
              <th class="p-3 font-semibold text-gray-700 text-sm text-right">Total Billed</th>
              <th class="p-3 font-semibold text-gray-700 text-sm text-right">Total Paid</th>
              <th class="p-3 font-semibold text-gray-700 text-sm text-right">Pending</th>
              <th class="p-3 font-semibold text-gray-700 text-sm text-center">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y bg-white">
    `;

    // Sort rows: Pending amounts first (descending), then fully paid
    const sortedRecords = Object.values(ledger).sort((a, b) => {
      const pendingA = a.totalBilled - a.totalPaid;
      const pendingB = b.totalBilled - b.totalPaid;
      return pendingB - pendingA; 
    });

    if (sortedRecords.length === 0) {
        tableHtml += `<tr><td colspan="5" class="p-4 text-center text-gray-500">No students found.</td></tr>`;
    } else {
        sortedRecords.forEach(record => {
          // Calculate Pending: Billed - Paid
          const pending = record.totalBilled - record.totalPaid;
          
          // Logic: Paid if pending is effectively 0 (handling float precision)
          const isPaid = pending <= 0.9; 
          
          const statusLabel = isPaid ? 'Paid' : 'Due';
          const statusClass = isPaid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
          const rowClass = isPaid ? 'opacity-60 hover:opacity-100' : 'font-medium bg-red-50 hover:bg-red-100'; 

          tableHtml += `
            <tr class="transition-colors ${rowClass}">
              <td class="p-3 text-sm text-gray-800 border-b-0">
                <div class="font-bold">${record.name}</div>
                <div class="text-xs text-gray-500">Room: ${record.room}</div>
              </td>
              <td class="p-3 text-sm text-right text-gray-600 border-b-0">₹${record.totalBilled.toFixed(0)}</td>
              <td class="p-3 text-sm text-right text-green-600 border-b-0">₹${record.totalPaid.toFixed(0)}</td>
              <td class="p-3 text-sm text-right border-b-0 ${isPaid ? 'text-gray-400' : 'text-red-600 font-bold'}">
                ₹${pending > 0 ? pending.toFixed(0) : '0'}
              </td>
              <td class="p-3 text-center border-b-0">
                <span class="px-2 py-1 rounded-full text-xs font-semibold ${statusClass}">
                  ${statusLabel}
                </span>
              </td>
            </tr>
          `;
        });
    }

    tableHtml += `</tbody></table></div>`;

    // 5. Update Modal UI Safely
    const modalContainer = document.getElementById('modalContainer');
    
    // Traverse DOM carefully to find the white box
    // Structure: #modalContainer -> Fixed Overlay (div) -> White Box (div)
    if (modalContainer && modalContainer.firstElementChild && modalContainer.firstElementChild.firstElementChild) {
        const modalBox = modalContainer.firstElementChild.firstElementChild;

        // Update classes to ensure it looks right (Wide width)
        modalBox.className = 'bg-white rounded-lg shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] relative z-50 transition-all transform scale-100';
        
        modalBox.innerHTML = `
          <div class="flex justify-between items-center p-5 border-b bg-gray-50 rounded-t-lg">
            <h2 class="text-2xl font-bold text-gray-800">Student Balance Ledger</h2>
            <button onclick="closeModal()" class="text-gray-400 hover:text-gray-700 transition text-3xl font-bold leading-none">&times;</button>
          </div>
          <div class="p-6 overflow-hidden flex flex-col bg-white rounded-b-lg">
              ${tableHtml}
          </div>
        `;
    } else {
        // Fallback: If DOM structure is unexpected, rebuild modal from scratch
        showModal('Student Balance Ledger', tableHtml);
        const box = document.querySelector('#modalContainer > div > div');
        if(box) box.classList.add('max-w-3xl');
    }

  } catch (err) {
    console.error("Payment Status Error:", err);
    // Update modal with error message
    const modalContainer = document.getElementById('modalContainer');
    if(modalContainer) {
        modalContainer.innerHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white p-6 rounded-lg shadow-xl max-w-sm text-center">
                    <div class="text-red-500 text-4xl mb-3">⚠️</div>
                    <h3 class="text-lg font-bold text-gray-800 mb-2">Error Loading Ledger</h3>
                    <p class="text-gray-600 mb-4 text-sm">${err.message}</p>
                    <button onclick="closeModal()" class="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300 w-full">Close</button>
                </div>
            </div>`;
    }
  }
});

// --- NEW: Meal Requests Logic ---
async function loadMealRequests() {
    const adminId = await getAdminId();
    if (!adminId) return;

    const tbody = document.getElementById('mealRequestsTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 italic">Loading requests...</td></tr>';

    // 1. Resolve Tenant ID from Admin ID
    const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', adminId)
        .single();

    if (profileError || !profile?.tenant_id) {
        console.error('Error resolving tenant ID:', profileError);
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">Error: Could not verify mess identity.</td></tr>';
        return;
    }

    // 2. Fetch meal requests using the correct tenant_id
    const { data: requests, error } = await supabase
        .from('meal_requests')
        .select(`
            *,
            students (name)
        `)
        .eq('tenant_id', profile.tenant_id) 
        .order('date', { ascending: false });

    if (error) {
        console.error('Error fetching meal requests:', error);
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">Error loading data.</td></tr>';
        return;
    }

    if (!tbody) return;
    tbody.innerHTML = '';

    // Calculate and update counts
    const pendingCount = (requests || []).filter(r => r.status === 'Requested').length;
    const fulfilledCount = (requests || []).filter(r => r.status === 'Fulfilled').length;
    
    const pendingEl = document.getElementById('pendingRequestsCount');
    const fulfilledEl = document.getElementById('fulfilledRequestsCount');
    if(pendingEl) pendingEl.textContent = pendingCount;
    if(fulfilledEl) fulfilledEl.textContent = fulfilledCount;

    if (requests && requests.length > 0) {
        requests.forEach(req => {
            const statusClass = req.status === 'Fulfilled' ? 'bg-green-100 text-green-800' : 
                                req.status === 'Cancelled' ? 'bg-red-100 text-red-800' : 
                                'bg-yellow-100 text-yellow-800';
            
            const actions = req.status === 'Requested' ? `
                <button onclick="updateMealRequestStatus('${req.id}', 'Fulfilled')" class="text-green-600 hover:text-green-800 mr-3 font-medium">Confirm</button>
                <button onclick="updateMealRequestStatus('${req.id}', 'Cancelled')" class="text-red-600 hover:text-red-800 font-medium">Cancel</button>
            ` : `<span class="text-gray-400 italic text-xs">No actions</span>`;

            const row = `
                <tr class="hover:bg-gray-50 border-b">
                    <td class="px-4 py-3 text-sm text-gray-900 font-medium">${req.students?.name || 'Unknown'}</td>
                    <td class="px-4 py-3 text-sm text-gray-900">${new Date(req.date).toLocaleDateString()}</td>
                    <td class="px-4 py-3 text-sm text-gray-900">${req.meal_type}</td>
                    <td class="px-4 py-3 text-sm">
                        <span class="px-2 py-1 rounded-full text-xs font-semibold ${statusClass}">
                            ${req.status}
                        </span>
                    </td>
                    <td class="px-4 py-3 text-sm">${actions}</td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-500 italic">No meal requests found.</td></tr>';
    }
}

window.updateMealRequestStatus = async function(requestId, newStatus) {
    if (!confirm(`Mark this request as ${newStatus}?`)) return;

    const { error } = await supabase
        .from('meal_requests')
        .update({ status: newStatus, updated_at: new Date() })
        .eq('id', requestId);

    if (error) {
        alert('Error updating request: ' + error.message);
    } else {
        loadMealRequests();
    }
};
