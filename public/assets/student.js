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

  // Fetch the student profile
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

// --- NEW: DASHBOARD STATE MANAGER ---
// This function decides what to show based on if the student has a mess or not
function updateDashboardState() {
    const messFeatures = document.getElementById('messFeatures');
    const noMessState = document.getElementById('noMessState');
    const messNameEl = document.getElementById('messName');

    if (currentStudent.mess_id) {
        // CASE A: Student HAS a Mess
        if(messFeatures) messFeatures.classList.remove('hidden');
        if(noMessState) noMessState.classList.add('hidden');
    } else {
        // CASE B: Student has NO Mess (Lite Mode)
        if(messFeatures) messFeatures.classList.add('hidden'); 
        if(noMessState) noMessState.classList.remove('hidden');
        
        if (messNameEl) {
            messNameEl.textContent = 'Not Enrolled';
            messNameEl.classList.add('text-orange-600');
        }
    }
}

async function loadStudentInfo() {
  if (!currentStudent) return;

  // Display student name
  document.getElementById('studentName').textContent = currentStudent.name;
  document.getElementById('welcomeName').textContent = currentStudent.name;

  // Fetch and display mess name
  if (currentStudent.mess_id) {
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
  }
}

async function loadAttendanceStats() {
  // SAFETY CHECK: Stop if no mess
  if (!currentStudent || !currentStudent.mess_id) return;

  const { data: attendance } = await supabase
    .from('attendance')
    .select('*')
    .eq('student_id', currentStudent.id)
    .order('marked_at', { ascending: false });

  const totalRecords = attendance?.length || 0;
  const presentRecords = attendance?.filter(a => a.status.toUpperCase() === 'PRESENT') || [];

  const presentDates = new Set(presentRecords.map(record => record.date));
  const distinctDaysPresent = presentDates.size;

  const attendanceRate = totalRecords > 0 ? ((presentRecords.length / totalRecords) * 100).toFixed(1) : 0;

  document.getElementById('attendancePercentage').textContent = `${attendanceRate}%`;
  document.getElementById('daysPresent').textContent = distinctDaysPresent;

  const recentContainer = document.getElementById('recentAttendance');
  recentContainer.innerHTML = ''; 

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

async function loadPaymentInfo() {
  // SAFETY CHECK: Stop if no mess
  if (!currentStudent || !currentStudent.mess_id) return;

  const { data: payments, error } = await supabase
    .from('payments')
    .select('*')
    .eq('student_id', currentStudent.id)
    .order('created_at', { ascending: false });

  const statusEl = document.getElementById('paymentStatus');
  const historyContainer = document.getElementById('paymentHistory');
  
  if (!statusEl || !historyContainer) return;

  historyContainer.innerHTML = ''; 

  if (!payments || payments.length === 0) {
    statusEl.innerHTML = `<span class="text-green-600">No Bills</span>`;
    historyContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No transaction history.</p>';
    return;
  }

  let totalBilled = 0;
  let totalPaid = 0;

  payments.forEach(p => {
      totalBilled += parseFloat(p.total_amount || 0);
      totalPaid += parseFloat(p.paid_amount || 0);
  });

  const netDue = totalBilled - totalPaid;

  if (netDue <= 0.5) {
    statusEl.innerHTML = netDue < -0.5 
        ? `<span class="text-green-600">Credit: ₹${Math.abs(netDue).toFixed(2)}</span>`
        : `<span class="text-green-600">Fully Paid</span>`;
  } else {
    statusEl.innerHTML = `<span class="text-red-600">Due: ₹${netDue.toFixed(2)}</span>`;
  }
  
  payments.forEach(payment => {
      const bill = parseFloat(payment.total_amount || 0);
      const pay = parseFloat(payment.paid_amount || 0);
      
      let title = '';
      let amountDisplay = '';
      let icon = '';
      let bgColor = '';

      if (bill > 0 && pay === 0) {
          title = 'Bill Generated';
          amountDisplay = `<span class="text-red-600 font-bold">- ₹${bill}</span>`;
          bgColor = 'bg-white';
          icon = `<div class="p-2 rounded-full bg-red-100 text-red-600"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg></div>`;
      } 
      else if (bill === 0 && pay > 0) {
          title = 'Payment Made';
          amountDisplay = `<span class="text-green-600 font-bold">+ ₹${pay}</span>`;
          bgColor = 'bg-green-50';
          icon = `<div class="p-2 rounded-full bg-green-100 text-green-600"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></div>`;
      }
      else {
          title = 'Transaction';
          amountDisplay = `<span class="text-gray-600">₹${Math.max(bill, pay)}</span>`;
          bgColor = 'bg-gray-50';
          icon = `<div class="p-2 rounded-full bg-gray-200 text-gray-600">?</div>`;
      }
      
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
    const el = document.getElementById('daysRemaining');
    if(el) el.textContent = 'N/A';
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
    const expiryDate = new Date(startDate);
    expiryDate.setDate(startDate.getDate() + plan.duration_days);
    
    const today = new Date();
    const diffTime = expiryDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const el = document.getElementById('daysRemaining');
    if(el) el.textContent = diffDays > 0 ? diffDays : 'Expired';
  } else {
    const el = document.getElementById('daysRemaining');
    if(el) el.textContent = 'N/A';
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

  const b = document.getElementById('breakfast');
  const l = document.getElementById('lunch');
  const d = document.getElementById('dinner');

  if(b) b.textContent = menu ? (menu.breakfast || 'Not available') : 'Not available';
  if(l) l.textContent = menu ? (menu.lunch || 'Not available') : 'Not available';
  if(d) d.textContent = menu ? (menu.dinner || 'Not available') : 'Not available';
}

function getMealTypeByTime() {
    const hour = new Date().getHours();
    if (hour >= 7 && hour < 11) return 'BREAKFAST';
    if (hour >= 12 && hour < 16) return 'LUNCH';
    if (hour >= 19 && hour < 22) return 'DINNER';
    return null;
}

async function checkTodayAttendance() {
  if (!currentStudent || !currentStudent.mess_id) return;
  const btn = document.getElementById('markAttendanceBtn');
  const msg = document.getElementById('attendanceMessage');
  const meal = getMealTypeByTime();

  if (!btn || !msg) return;

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

function setupStarRating() {
  const container = document.getElementById('starRatingContainer');
  const ratingInput = document.getElementById('starRating');
  if(!container || !ratingInput) return;
  
  container.innerHTML = ''; 

  for (let i = 1; i <= 5; i++) {
    const star = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    star.setAttribute('data-value', i);
    star.setAttribute('class', 'h-8 w-8 text-gray-400 cursor-pointer');
    star.setAttribute('fill', 'currentColor');
    star.setAttribute('viewBox', '0 0 24 24');
    star.setAttribute('stroke', 'none');
    
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
  if (!currentStudent || !currentStudent.mess_id) return;

  const { data: review, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('student_id', currentStudent.id)
    .maybeSingle();

  const reviewText = document.getElementById('reviewText');
  const ratingInput = document.getElementById('starRating');
  const submitBtn = document.getElementById('submitReviewBtn');
  const deleteBtn = document.getElementById('deleteReviewBtn');

  if (review) {
    if(ratingInput) ratingInput.value = review.rating;
    updateStars(review.rating);
    if(reviewText) reviewText.value = review.review_text || '';
    if(submitBtn) submitBtn.textContent = 'Update My Review';
    if(deleteBtn) deleteBtn.classList.remove('hidden');
  } else {
    if(ratingInput) ratingInput.value = 0;
    updateStars(0);
    if(reviewText) reviewText.value = '';
    if(submitBtn) submitBtn.textContent = 'Submit Review';
    if(deleteBtn) deleteBtn.classList.add('hidden');
  }
}

async function handleSubmitReview(e) {
  e.preventDefault();
  if (!currentStudent || !currentStudent.mess_id) return;

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
      { onConflict: 'student_id' }
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
  if (!currentStudent || !currentStudent.mess_id) return;
  if (!confirm('Are you sure you want to delete your review?')) return;

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
    document.getElementById('starRating').value = 0;
    updateStars(0);
    document.getElementById('reviewText').value = '';
    document.getElementById('submitReviewBtn').textContent = 'Submit Review';
    document.getElementById('deleteReviewBtn').classList.add('hidden');
  }
}

// Attendance Button Listener
const attBtn = document.getElementById('markAttendanceBtn');
if (attBtn) {
    attBtn.addEventListener('click', async () => {
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
}

// Receipt Listener
const dlBtn = document.getElementById('downloadReceiptBtn');
if(dlBtn) {
    dlBtn.addEventListener('click', async () => {
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

      doc.text(`Amount Paid: ₹${payment.total_amount}`, 20, 90);
      doc.text(`Payment Date: ${new Date(payment.paid_on).toLocaleDateString()}`, 20, 100);
      doc.text(`Status: ${payment.status}`, 20, 110);

      doc.save(`receipt_${payment.id}.pdf`);
    });
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
});

document.addEventListener('DOMContentLoaded', async () => {
  currentStudent = await checkAuth();
  if (currentStudent) {
    // 1. UPDATE DASHBOARD STATE FIRST
    updateDashboardState();
    
    // 2. Load Mess Info (Safely inside updateDashboardState logic or here)
    await loadStudentInfo();
    
    if (currentStudent.mess_id) {
        await loadAttendanceStats();
        await loadPaymentInfo();
        await loadTodayMenu();
        await checkTodayAttendance();
        await loadPlanDaysRemaining();
        
        setupStarRating();
        await loadMyReview();
        document.getElementById('reviewForm').addEventListener('submit', handleSubmitReview);
        document.getElementById('deleteReviewBtn').addEventListener('click', handleDeleteReview);
    }

    // 3. Always run CA logic
    await checkCaStatus();

    // 4. Auto Removal Check
    setTimeout(checkAutoRemoval, 2000); 
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

if(changeMessBtn) changeMessBtn.addEventListener('click', () => changeMessModal.classList.remove('hidden'));
if(closeChangeMessBtn) {
    closeChangeMessBtn.addEventListener('click', () => {
        changeMessModal.classList.add('hidden');
        if(changeMessForm) changeMessForm.reset(); 
        if(newPlanDiv) newPlanDiv.classList.add('hidden');
    });
}

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

            if(newPlanSelect) {
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
                    const opt = document.createElement('option');
                    opt.textContent = "No plans found / Invalid ID";
                    newPlanSelect.appendChild(opt);
                    newPlanDiv.classList.remove('hidden');
                }
            }
        }, 500);
    });
}

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

        if (!confirm("Are you sure you want to switch/join this mess?")) return;

        confirmBtn.disabled = true;
        confirmBtn.textContent = "Joining...";

        try {
            const { error } = await supabase
                .from('students')
                .update({
                    mess_id: newMessId,
                    plan_type: newPlan,
                    plan_start_date: new Date().toISOString(), 
                    status: 'Active', 
                    room_no: 'Not Assigned' 
                })
                .eq('user_id', currentStudent.user_id);

            if (error) throw error;

            alert("Successfully joined new mess!");
            location.reload(); 

        } catch (err) {
            console.error(err);
            alert("Error joining mess: " + err.message);
            confirmBtn.disabled = false;
            confirmBtn.textContent = "Confirm & Join";
        }
    });
}

async function checkAutoRemoval() {
    if (!currentStudent || !currentStudent.mess_id || !currentStudent.plan_start_date) return;

    const { data: plan } = await supabase
        .from('plans')
        .select('duration_days')
        .eq('mess_id', currentStudent.mess_id)
        .eq('name', currentStudent.plan_type)
        .single();

    if (!plan) return;

    const startDate = new Date(currentStudent.plan_start_date);
    const expiryDate = new Date(startDate);
    expiryDate.setDate(startDate.getDate() + plan.duration_days);
    
    const removalThreshold = new Date(expiryDate);
    removalThreshold.setDate(expiryDate.getDate() + 2); 

    const today = new Date();

    if (today > removalThreshold && currentStudent.mess_id !== null) {
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
            alert("Your plan expired > 2 days ago. You have been removed from the mess.");
            location.reload();
        }
    }
}

// --- CAMPUS AMBASSADOR LOGIC ---
// 1. Open Modal
window.applyForCA = function() {
    const modal = document.getElementById('caModal');
    if(!modal || !currentStudent) return;

    document.getElementById('caName').value = currentStudent.name || '';
    document.getElementById('caPhone').value = currentStudent.mobile || '';
    document.getElementById('caEmail').value = currentStudent.email || '';
    
    const collegeInput = document.getElementById('caCollege');
    if (currentStudent.college && currentStudent.college !== 'Not Specified') {
        collegeInput.value = currentStudent.college;
    } else {
        collegeInput.value = ''; 
    }

    modal.classList.remove('hidden');
}

window.closeCAModal = function() {
    document.getElementById('caModal').classList.add('hidden');
}

const caForm = document.getElementById('caApplicationForm');
if (caForm) {
    caForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submitCaBtn');
        btn.disabled = true;
        btn.textContent = 'Uploading...';

        try {
            const college = document.getElementById('caCollege').value.trim();
            const year = document.getElementById('caYear').value;
            const reasonCa = document.getElementById('caReason').value;
            const reasonHire = document.getElementById('caWhyHire').value;
            const resumeFile = document.getElementById('caResume').files[0];

            if(!college) throw new Error("College Name is required");
            if(!resumeFile) throw new Error("Resume is required");

            const fileExt = resumeFile.name.split('.').pop();
            const fileName = `ca_${currentStudent.id}_${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
                .from('ca_resumes')
                .upload(fileName, resumeFile);

            if (uploadError) throw new Error("Resume upload failed: " + uploadError.message);

            const { data: { publicUrl } } = supabase.storage
                .from('ca_resumes')
                .getPublicUrl(fileName);

            const { error: appError } = await supabase.from('ca_hire').insert({
                student_id: currentStudent.id,
                name: currentStudent.name,
                phone: currentStudent.mobile,
                email: currentStudent.email,
                college: college,
                year: year,
                reason_ca: reasonCa,
                reason_hire: reasonHire,
                resume_url: publicUrl
            });

            if (appError) throw new Error("Application save failed: " + appError.message);

            const { error: caError } = await supabase.from('campus_ambassadors').insert({
                student_id: currentStudent.id,
                status: 'pending'
            });

            if (caError) throw new Error("System error: " + caError.message);

            alert("Application submitted successfully! HR will review your profile.");
            closeCAModal();
            checkCaStatus(); 

        } catch (error) {
            console.error(error);
            alert(error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Submit Application';
        }
    });
}

async function checkCaStatus() {
    if (!currentStudent) return; 

    const container = document.getElementById('caActionContainer');
    const text = document.getElementById('caStatusText');
    
    if(!container || !text) return;

    const { data: ca } = await supabase.from('campus_ambassadors')
        .select('status')
        .eq('student_id', currentStudent.id)
        .maybeSingle();

    if (!ca) {
        const btn = document.getElementById('applyCaBtn');
        if(btn) btn.onclick = window.applyForCA; 
    } else if (ca.status === 'pending') {
        container.innerHTML = `<span class="text-yellow-600 font-bold bg-yellow-100 px-4 py-2 rounded-lg">Application Pending</span>`;
        text.textContent = "Your application is under review.";
    } else if (ca.status === 'approved') {
        container.innerHTML = `<a href="campusambassador.html" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 shadow-lg font-bold flex items-center">Go to CA Dashboard →</a>`;
        text.textContent = "You are an active Campus Ambassador!";
    } else if (ca.status === 'rejected') {
        container.innerHTML = `<span class="text-red-600 font-bold">Application Rejected</span>`;
    }
}