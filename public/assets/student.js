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
    .eq('student_id', currentStudent.id)
    .order('marked_at', { ascending: false });

  const totalRecords = attendance?.length || 0;
  const presentRecords = attendance?.filter(a => a.status.toUpperCase() === 'PRESENT') || [];

  // --- CORRECTED DAYS PRESENT CALCULATION ---
  // 1. Get all unique dates where the student was present
  const presentDates = new Set(presentRecords.map(record => record.date));
  // 2. Count the number of unique dates
  const distinctDaysPresent = presentDates.size;
  // --- END OF CORRECTION ---

  // Calculate attendance rate based on records (meals), as before
  const attendanceRate = totalRecords > 0 ? ((presentRecords.length / totalRecords) * 100).toFixed(1) : 0;

  document.getElementById('attendancePercentage').textContent = `${attendanceRate}%`;
  // Update the display to use the distinct day count
  document.getElementById('daysPresent').textContent = distinctDaysPresent;

  const recentContainer = document.getElementById('recentAttendance');
  recentContainer.innerHTML = ''; // Clear previous

  if (attendance && attendance.length > 0) {
    const recent = attendance.slice(0, 7);
    recent.forEach(record => {
        const isPresent = record.status.toUpperCase() === 'PRESENT';
        const statusClass = isPresent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
        const mealText = record.meal ? ` - ${record.meal}` : '';

        recentContainer.innerHTML += `
          <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div>
              <p class="font-semibold text-gray-800">${new Date(record.date).toLocaleDateString()}${mealText}</p>
              <p class="text-xs text-gray-500">${new Date(record.marked_at).toLocaleTimeString()}</p>
            </div>
            <span class="px-3 py-1 rounded-full text-xs font-semibold ${statusClass}">
              ${record.status}
            </span>
          </div>
        `;
    });
  } else {
    recentContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No attendance records yet</p>';
  }
}

// --- FIXED: Payment Ledger Logic for Student ---
async function loadPaymentInfo() {
  if (!currentStudent) return;

  // 1. Fetch ALL transactions (Bills AND Payments)
  const { data: payments, error } = await supabase
    .from('payments')
    .select('*')
    .eq('student_id', currentStudent.id)
    .order('created_at', { ascending: false }); // Newest first

  const statusEl = document.getElementById('paymentStatus');
  const historyContainer = document.getElementById('paymentHistory');
  
  if (!statusEl || !historyContainer) return;

  historyContainer.innerHTML = ''; // Clear previous entries

  if (!payments || payments.length === 0) {
    statusEl.innerHTML = `<span class="text-green-600">No Bills</span>`;
    historyContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No transaction history.</p>';
    return;
  }

  // 2. Calculate Ledger Balance (Total Billed - Total Paid)
  let totalBilled = 0;
  let totalPaid = 0;

  payments.forEach(p => {
      totalBilled += parseFloat(p.total_amount || 0);
      totalPaid += parseFloat(p.paid_amount || 0);
  });

  const netDue = totalBilled - totalPaid;

  // 3. Update Status Card (Top Card)
  // Use a small buffer (0.5) for float precision issues
  if (netDue <= 0.5) {
    statusEl.innerHTML = `<span class="text-green-600">Fully Paid</span>`;
    // Optional: Show credit if they overpaid
    if (netDue < -0.5) {
        statusEl.innerHTML = `<span class="text-green-600">Credit: ₹${Math.abs(netDue).toFixed(2)}</span>`;
    }
  } else {
    statusEl.innerHTML = `<span class="text-red-600">Due: ₹${netDue.toFixed(2)}</span>`;
  }
  
  // 4. Render History List (Distinguish Bills vs Payments)
  payments.forEach(payment => {
      const bill = parseFloat(payment.total_amount || 0);
      const pay = parseFloat(payment.paid_amount || 0);
      
      let title = '';
      let amountDisplay = '';
      let icon = '';
      let bgColor = '';

      // Determine Row Type
      if (bill > 0 && pay === 0) {
          // It's a BILL
          title = 'Bill Generated';
          amountDisplay = `<span class="text-red-600 font-bold">- ₹${bill}</span>`;
          bgColor = 'bg-white';
          icon = `<div class="p-2 rounded-full bg-red-100 text-red-600"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg></div>`;
      } 
      else if (bill === 0 && pay > 0) {
          // It's a PAYMENT
          title = 'Payment Made';
          amountDisplay = `<span class="text-green-600 font-bold">+ ₹${pay}</span>`;
          bgColor = 'bg-green-50';
          icon = `<div class="p-2 rounded-full bg-green-100 text-green-600"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></div>`;
      }
      else {
          // Mixed / Old Record
          title = 'Transaction';
          amountDisplay = `<span class="text-gray-600">₹${Math.max(bill, pay)}</span>`;
          bgColor = 'bg-gray-50';
          icon = `<div class="p-2 rounded-full bg-gray-200 text-gray-600">?</div>`;
      }
      
      // Generate HTML
      historyContainer.innerHTML += `
        <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg ${bgColor}">
          <div class="flex items-center space-x-3">
            ${icon}
            <div>
                <p class="font-semibold text-gray-800 text-sm">${title}</p>
                <p class="text-xs text-gray-500">${new Date(payment.created_at || payment.due_date).toLocaleDateString()}</p>
            </div>
          </div>
          <div class="text-right">
            ${amountDisplay}
          </div>
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

// --- REVIEW FUNCTIONS ---

// --- FIX: This function now correctly creates the SVG stars ---
function setupStarRating() {
  const container = document.getElementById('starRatingContainer');
  const ratingInput = document.getElementById('starRating');
  container.innerHTML = ''; // Clear placeholder

  for (let i = 1; i <= 5; i++) {
    const star = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    star.setAttribute('data-value', i);
    star.setAttribute('class', 'h-8 w-8 text-gray-400 cursor-pointer');
    star.setAttribute('fill', 'currentColor');
    star.setAttribute('viewBox', '0 0 24 24'); // Use 24x24 viewbox for consistency
    star.setAttribute('stroke', 'none');
    
    // Use the filled star path
    star.innerHTML = `<path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 9.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>`;
    
    star.addEventListener('click', () => {
      ratingInput.value = i;
      updateStars(i);
    });
    
    star.addEventListener('mouseover', () => updateStars(i, true));
    star.addEventListener('mouseout', () => updateStars(parseInt(ratingInput.value)));
    
    container.appendChild(star);
  }
}

function updateStars(rating, isHover = false) {
  const stars = document.querySelectorAll('#starRatingContainer svg');
  stars.forEach(star => {
    const starValue = parseInt(star.getAttribute('data-value'));
    if (starValue <= rating) {
      star.classList.remove('text-gray-400');
      star.classList.add(isHover ? 'text-yellow-300' : 'text-yellow-500');
    } else {
      star.classList.remove('text-yellow-500', 'text-yellow-300');
      star.classList.add('text-gray-400');
    }
  });
}

async function loadMyReview() {
  if (!currentStudent) return;

  const { data: review, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('student_id', currentStudent.id)
    .maybeSingle();

  if (review) {
    document.getElementById('starRating').value = review.rating;
    updateStars(review.rating);
    document.getElementById('reviewText').value = review.review_text || '';
    document.getElementById('submitReviewBtn').textContent = 'Update My Review';
    document.getElementById('deleteReviewBtn').classList.remove('hidden');
  } else {
    // No review yet, ensure fields are clear
    document.getElementById('starRating').value = 0;
    updateStars(0);
    document.getElementById('reviewText').value = '';
    document.getElementById('submitReviewBtn').textContent = 'Submit Review';
    document.getElementById('deleteReviewBtn').classList.add('hidden');
  }
}

async function handleSubmitReview(e) {
  e.preventDefault();
  if (!currentStudent) return;

  const rating = parseInt(document.getElementById('starRating').value);
  const reviewText = document.getElementById('reviewText').value;
  const msgEl = document.getElementById('reviewMessage');

  if (rating === 0) {
    msgEl.textContent = 'Please select a rating (1-5 stars)';
    msgEl.className = 'text-sm text-red-600';
    return;
  }

  msgEl.textContent = 'Submitting...';
  msgEl.className = 'text-sm text-gray-500';

  const { error } = await supabase
    .from('reviews')
    .upsert(
      {
        student_id: currentStudent.id,
        mess_id: currentStudent.mess_id,
        rating: rating,
        review_text: reviewText
      },
      { onConflict: 'student_id' } // This makes it an "update if exists"
    );
  
  if (error) {
    msgEl.textContent = 'Error: ' + error.message;
    msgEl.className = 'text-sm text-red-600';
  } else {
    msgEl.textContent = 'Review submitted successfully!';
    msgEl.className = 'text-sm text-green-600';
    document.getElementById('submitReviewBtn').textContent = 'Update My Review';
    document.getElementById('deleteReviewBtn').classList.remove('hidden');
  }
}

async function handleDeleteReview() {
  if (!currentStudent || !confirm('Are you sure you want to delete your review?')) return;

  const msgEl = document.getElementById('reviewMessage');
  msgEl.textContent = 'Deleting...';
  msgEl.className = 'text-sm text-gray-500';

  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('student_id', currentStudent.id);

  if (error) {
    msgEl.textContent = 'Error: ' + error.message;
    msgEl.className = 'text-sm text-red-600';
  } else {
    msgEl.textContent = 'Review deleted.';
    msgEl.className = 'text-sm text-green-600';
    // Reset the form
    document.getElementById('starRating').value = 0;
    updateStars(0);
    document.getElementById('reviewText').value = '';
    document.getElementById('submitReviewBtn').textContent = 'Submit Review';
    document.getElementById('deleteReviewBtn').classList.add('hidden');
  }
}

// --- END REVIEW FUNCTIONS ---


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

  doc.text(`Amount Paid: ₹${payment.total_amount}`, 20, 90); // Use total_amount
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
    
    // --- NEW REVIEW LISTENERS ---
    setupStarRating();
    await loadMyReview();
    document.getElementById('reviewForm').addEventListener('submit', handleSubmitReview);
    document.getElementById('deleteReviewBtn').addEventListener('click', handleDeleteReview);
  }
});

// --- CHANGE MESS & AUTO-REMOVAL LOGIC ---

const changeMessModal = document.getElementById('changeMessModal');
const changeMessBtn = document.getElementById('changeMessBtn');
const closeChangeMessBtn = document.getElementById('closeChangeMessBtn');
const newMessIdInput = document.getElementById('newMessId');
const newPlanDiv = document.getElementById('newPlanDiv');
const newPlanSelect = document.getElementById('newPlanSelect');
const changeMessForm = document.getElementById('changeMessForm');

// 1. UI Toggles
if(changeMessBtn) changeMessBtn.addEventListener('click', () => changeMessModal.classList.remove('hidden'));
if(closeChangeMessBtn) {
    closeChangeMessBtn.addEventListener('click', () => {
        changeMessModal.classList.add('hidden');
        
        // NEW: Reset the form on close
        if(changeMessForm) changeMessForm.reset(); 
        newPlanDiv.classList.add('hidden');
    });
}
// 2. Fetch Plans when Mess ID is entered (Debounced)
let planTimeout;
if(newMessIdInput) {
    newMessIdInput.addEventListener('input', (e) => {
        clearTimeout(planTimeout);
        const messId = e.target.value.trim();
        
        if (!messId) {
            newPlanDiv.classList.add('hidden');
            return;
        }

        planTimeout = setTimeout(async () => {
            const { data: plans, error } = await supabase
                .from('plans')
                .select('name, price')
                .eq('mess_id', messId);

            newPlanSelect.innerHTML = '<option value="" disabled selected>Select a plan</option>';
            
            if (!error && plans && plans.length > 0) {
                plans.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.name;
                    opt.textContent = `${p.name} (₹${p.price})`;
                    newPlanSelect.appendChild(opt);
                });
                newPlanDiv.classList.remove('hidden');
            } else {
                // Invalid ID or no plans
                const opt = document.createElement('option');
                opt.textContent = "No plans found / Invalid ID";
                newPlanSelect.appendChild(opt);
                newPlanDiv.classList.remove('hidden');
            }
        }, 500);
    });
}

// 3. Handle Switching Mess (Update Student Record)
if(changeMessForm) {
    changeMessForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newMessId = newMessIdInput.value.trim();
        const newPlan = newPlanSelect.value;
        const confirmBtn = document.getElementById('confirmChangeBtn');

        if (!newPlan || !newMessId) {
            alert("Please select a valid mess and plan.");
            return;
        }

        if (!confirm("Are you sure you want to switch to this mess? Your previous data will be archived.")) return;

        confirmBtn.disabled = true;
        confirmBtn.textContent = "Joining...";

        try {
            // Update the EXISTING student record (Profile remains, Mess changes)
            const { error } = await supabase
                .from('students')
                .update({
                    mess_id: newMessId,
                    plan_type: newPlan,
                    plan_start_date: new Date().toISOString(), // Reset start date
                    status: 'Active', // Reactivate if they were expired
                    room_no: 'Not Assigned' // Reset room until admin assigns one
                })
                .eq('user_id', currentStudent.user_id);

            if (error) throw error;

            alert("Successfully joined new mess!");
            location.reload(); // Reload to refresh dashboard data

        } catch (err) {
            console.error(err);
            alert("Error joining mess: " + err.message);
            confirmBtn.disabled = false;
            confirmBtn.textContent = "Confirm & Join";
        }
    });
}

// 4. AUTO-REMOVAL Logic (Run on Dashboard Load)
async function checkAutoRemoval() {
    if (!currentStudent || !currentStudent.mess_id || !currentStudent.plan_start_date) return;

    // 1. Fetch plan duration
    const { data: plan } = await supabase
        .from('plans')
        .select('duration_days')
        .eq('mess_id', currentStudent.mess_id)
        .eq('name', currentStudent.plan_type)
        .single();

    if (!plan) return;

    // 2. Calculate dates
    const startDate = new Date(currentStudent.plan_start_date);
    const expiryDate = new Date(startDate);
    expiryDate.setDate(startDate.getDate() + plan.duration_days);
    
    const removalThreshold = new Date(expiryDate);
    removalThreshold.setDate(expiryDate.getDate() + 2); // +2 Days Buffer

    const today = new Date();

    // 3. Check if we are past the threshold
    if (today > removalThreshold && currentStudent.mess_id !== null) {
        console.log("Plan expired > 2 days ago. Auto-removing student from mess...");
        
        // "Remove" simply means setting mess_id to NULL so they are free
        const { error } = await supabase
            .from('students')
            .update({ 
                mess_id: null,
                status: 'Inactive',
                plan_type: null,
                room_no: ''
            })
            .eq('id', currentStudent.id);

        if (!error) {
            alert("Your previous plan expired more than 2 days ago. You have been removed from the mess. Please join a new mess.");
            location.reload();
        }
    }
}

// Add this to your init sequence
document.addEventListener('DOMContentLoaded', async () => {
    // ... existing calls ...
    // Wait for currentStudent to be loaded, then check
    setTimeout(checkAutoRemoval, 2000); 
});