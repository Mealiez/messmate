import { supabase } from '../supabaseConfig.js';

// --- AUTH CHECK ---
async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = 'login.html'; return; }
    
    // Check Role via RPC function to avoid recursion
    const { data: isAuthorized, error } = await supabase.rpc('is_super_admin');
    
    if (error || !isAuthorized) {
        alert("Unauthorized access.");
        window.location.href = 'index.html';
    }
}

// --- TAB SWITCHING ---
window.switchTab = (tab) => {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(el => el.classList.add('hidden'));
    
    // Show selected section
    const section = document.getElementById(`${tab}Section`);
    if(section) section.classList.remove('hidden');

    // Update Sidebar Active State
    document.querySelectorAll('nav button').forEach(el => el.classList.remove('bg-blue-600'));
    const btn = document.getElementById(`btn-${tab}`);
    if(btn) btn.classList.add('bg-blue-600');

    // Update Title & Load Data
    const titles = { 
        'applicants': 'Manage CA Applicants', 
        'submissions': 'Review Task Reports', 
        'tasks': 'Manage Tasks',
        'withdrawals': 'Withdrawal Requests',
        'interns': 'Intern Applications',
        'tenants': 'Tenant Config',
        'planMgmt': 'Plan Management',
        'manageInternships': 'Manage Internships'
    };
    const titleEl = document.getElementById('pageTitle');
    if(titleEl) titleEl.textContent = titles[tab] || 'Dashboard';

    if(tab === 'applicants') loadApplicants();
    if(tab === 'submissions') loadSubmissions();
    if(tab === 'tasks') loadTasks();
    if(tab === 'withdrawals') loadWithdrawals();
    if(tab === 'interns') loadInterns();
    if(tab === 'tenants') loadTenants();
    if(tab === 'planMgmt') loadPlanManagement();
    if(tab === 'manageInternships') loadInternships();
};

// ============================================================
// 1. CA APPLICANTS LOGIC (Detailed View from ca_hire)
// ============================================================
async function loadApplicants() {
    const tbody = document.getElementById('applicantsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center">Loading applications...</td></tr>';

    try {
        // A. Fetch Application Details (Form Data)
        const { data: applications, error: appError } = await supabase
            .from('ca_hire')
            .select('*')
            .order('created_at', { ascending: false });

        if (appError) throw appError;

        // B. Fetch Current Status (System Record)
        const { data: statusRecords, error: statusError } = await supabase
            .from('campus_ambassadors')
            .select('id, student_id, status');

        if (statusError) throw statusError;

        // C. Merge Data
        const applicants = applications.map(app => {
            const statusRecord = statusRecords.find(r => r.student_id === app.student_id);
            return {
                ...app,
                ca_record_id: statusRecord ? statusRecord.id : null,
                status: statusRecord ? statusRecord.status : 'unknown'
            };
        });

        tbody.innerHTML = '';
        if (applicants.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-500">No applications received.</td></tr>';
            return;
        }

        applicants.forEach(app => {
            const statusColors = {
                'pending': 'bg-yellow-100 text-yellow-700',
                'approved': 'bg-green-100 text-green-700',
                'rejected': 'bg-red-100 text-red-700'
            };
            const badgeClass = statusColors[app.status] || 'bg-gray-100 text-gray-600';

            // Action Buttons (Only for Pending)
            let actionButtons = '-';
            if (app.status === 'pending') {
                actionButtons = `
                    <div class="flex gap-2">
                        <button onclick="updateCAStatus('${app.ca_record_id}', 'approved')" class="bg-green-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-green-700 shadow transition">Approve</button>
                        <button onclick="updateCAStatus('${app.ca_record_id}', 'rejected')" class="bg-red-100 text-red-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-red-200 transition">Reject</button>
                    </div>
                `;
            }

            // Truncate long text
            const reasonShort = app.reason_ca && app.reason_ca.length > 50 ? app.reason_ca.substring(0, 50) + '...' : (app.reason_ca || '');

            tbody.innerHTML += `
                <tr class="hover:bg-gray-50 transition">
                    <td class="p-4">
                        <div class="flex flex-col">
                            <span class="font-bold text-gray-900">${app.name}</span>
                            <a href="mailto:${app.email}" class="text-xs text-blue-600 hover:underline">${app.email}</a>
                            <span class="text-xs text-gray-500">${app.phone}</span>
                        </div>
                    </td>
                    <td class="p-4">
                        <div class="text-sm font-medium text-gray-800">${app.college}</div>
                        <div class="text-xs text-gray-500">${app.year}</div>
                    </td>
                    <td class="p-4 max-w-xs whitespace-normal">
                        <div class="text-xs text-gray-600">
                            <span class="font-semibold text-gray-700">Why:</span> "${reasonShort}"
                        </div>
                    </td>
                    <td class="p-4">
                        <div class="flex gap-2">
                             <a href="${app.resume_url}" target="_blank" class="bg-blue-50 text-blue-600 px-3 py-1.5 rounded text-xs font-semibold hover:bg-blue-100 border border-blue-200 flex items-center transition">
                                View
                            </a>
                            <a href="${app.resume_url}?download=" download class="bg-gray-50 text-gray-600 px-3 py-1.5 rounded text-xs font-semibold hover:bg-gray-100 border border-gray-200 flex items-center transition">
                                DL
                            </a>
                        </div>
                    </td>
                    <td class="p-4">
                        <span class="px-2 py-1 rounded-full text-xs font-bold uppercase ${badgeClass}">
                            ${app.status}
                        </span>
                    </td>
                    <td class="p-4">
                        ${actionButtons}
                    </td>
                </tr>
            `;
        });

    } catch (err) {
        console.error("Error loading applicants:", err);
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">Error: ${err.message}</td></tr>`;
    }
}

window.updateCAStatus = async (caRecordId, status) => {
    if (!caRecordId) return alert("Error: Invalid Record ID");
    if (!confirm(`Mark applicant as ${status.toUpperCase()}?`)) return;

    const { error } = await supabase.from('campus_ambassadors').update({ status }).eq('id', caRecordId);
    if(error) alert(error.message);
    else loadApplicants();
};


// ============================================================
// 2. TASK SUBMISSIONS REVIEW LOGIC
// ============================================================
async function loadSubmissions() {
    const grid = document.getElementById('submissionsGrid');
    if(!grid) return;
    grid.innerHTML = '<p class="p-4">Loading...</p>';

    const { data: subs } = await supabase
        .from('ca_submissions')
        .select('*, ca:campus_ambassadors(student_id), task:ca_tasks(title, default_points)')
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false });

    grid.innerHTML = '';
    if(!subs || subs.length === 0) {
        grid.innerHTML = '<p class="text-gray-500">No pending submissions.</p>';
        return;
    }

    subs.forEach(sub => {
        grid.innerHTML += `
            <div class="bg-white p-6 rounded-lg shadow flex flex-col md:flex-row justify-between items-start gap-4">
                <div>
                    <h4 class="font-bold text-lg text-gray-800">${sub.task?.title || 'Unknown Task'}</h4>
                    <a href="${sub.report_url}" target="_blank" class="text-blue-600 underline text-sm hover:text-blue-800 flex items-center mt-1">
                        View Report Proof 📎
                    </a>
                    <p class="text-xs text-gray-400 mt-2">Submitted: ${new Date(sub.submitted_at).toLocaleString()}</p>
                </div>
                <div class="flex flex-col items-end gap-2 w-full md:w-auto">
                    <div class="flex items-center gap-2">
                        <label class="text-xs font-bold text-gray-500">Points:</label>
                        <input type="number" id="points-${sub.id}" value="${sub.task?.default_points || 0}" class="w-20 border rounded px-2 py-1 text-right">
                    </div>
                    <div class="flex gap-2 mt-2 w-full justify-end">
                        <button onclick="reviewTask('${sub.id}', '${sub.ca_id}', 'approved')" class="bg-green-600 text-white px-4 py-1 rounded text-sm hover:bg-green-700">Approve</button>
                        <button onclick="reviewTask('${sub.id}', '${sub.ca_id}', 'rejected')" class="bg-red-200 text-red-800 px-4 py-1 rounded text-sm hover:bg-red-300">Reject</button>
                    </div>
                </div>
            </div>
        `;
    });
}

window.reviewTask = async (subId, caId, status) => {
    const pointsInput = document.getElementById(`points-${subId}`);
    const points = status === 'approved' ? parseInt(pointsInput.value) : 0;

    const { error: subError } = await supabase.from('ca_submissions')
        .update({ status, points_awarded: points }).eq('id', subId);
    
    if(subError) { alert(subError.message); return; }

    if (status === 'approved') {
        const { data: ca } = await supabase.from('campus_ambassadors').select('total_points').eq('id', caId).single();
        const newTotal = (ca.total_points || 0) + points;
        await supabase.from('campus_ambassadors').update({ total_points: newTotal }).eq('id', caId);
    }
    loadSubmissions();
};


// ============================================================
// 3. DYNAMIC TASK MANAGEMENT (CRUD)
// ============================================================
async function loadTasks() {
    const list = document.getElementById('tasksList');
    if(!list) return;
    list.innerHTML = '<tr><td colspan="3" class="p-4 text-center">Loading tasks...</td></tr>';

    const { data: tasks, error } = await supabase
        .from('ca_tasks')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        list.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-red-500">Error: ${error.message}</td></tr>`;
        return;
    }

    list.innerHTML = '';
    if (!tasks || tasks.length === 0) {
        list.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-500">No tasks defined. Add one to get started!</td></tr>';
        return;
    }

    tasks.forEach(t => {
        const safeTitle = t.title.replace(/'/g, "\\'");
        const safeDesc = (t.description || '').replace(/'/g, "\\'");

        list.innerHTML += `
            <tr class="hover:bg-gray-50 group">
                <td class="p-4">
                    <p class="font-bold text-gray-800">${t.title}</p>
                    <p class="text-sm text-gray-500">${t.description || 'No description'}</p>
                </td>
                <td class="p-4 text-center">
                    <span class="bg-blue-100 text-blue-700 py-1 px-3 rounded-full text-xs font-bold">${t.default_points} pts</span>
                </td>
                <td class="p-4 text-center">
                    <div class="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="openTaskModal('${t.id}', '${safeTitle}', '${safeDesc}', '${t.default_points}')" class="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-2 rounded">
                            Edit
                        </button>
                        <button onclick="deleteTask('${t.id}')" class="text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 p-2 rounded">
                            Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
}

window.openTaskModal = (id = '', title = '', desc = '', points = '') => {
    const modal = document.getElementById('taskModal');
    if(!modal) return;
    
    document.getElementById('taskId').value = id;
    document.getElementById('taskTitle').value = title;
    document.getElementById('taskDesc').value = desc;
    document.getElementById('taskPoints').value = points;
    
    const titleEl = document.getElementById('modalTitle');
    if(titleEl) titleEl.textContent = id ? 'Edit Task' : 'Add New Task';
    
    modal.classList.remove('hidden');
};

window.closeTaskModal = () => {
    const modal = document.getElementById('taskModal');
    if(modal) modal.classList.add('hidden');
    const form = document.getElementById('taskForm');
    if(form) form.reset();
};

const taskForm = document.getElementById('taskForm');
if(taskForm) {
    taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('saveTaskBtn');
        btn.disabled = true;
        btn.textContent = 'Saving...';

        const id = document.getElementById('taskId').value;
        const title = document.getElementById('taskTitle').value;
        const desc = document.getElementById('taskDesc').value;
        const points = document.getElementById('taskPoints').value;

        let error;
        if (id) {
            const { error: err } = await supabase.from('ca_tasks').update({ title, description: desc, default_points: points }).eq('id', id);
            error = err;
        } else {
            const { error: err } = await supabase.from('ca_tasks').insert({ title, description: desc, default_points: points });
            error = err;
        }

        if (error) alert("Error: " + error.message);
        else { closeTaskModal(); loadTasks(); }
        btn.disabled = false;
        btn.textContent = 'Save Task';
    });
}

window.deleteTask = async (id) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    const { error } = await supabase.from('ca_tasks').delete().eq('id', id);
    if (error) alert("Error: " + error.message);
    else loadTasks();
};


// ============================================================
// 4. INTERN APPLICATIONS LOGIC
// ============================================================
async function loadInterns() {
    const tbody = document.getElementById('internsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center">Loading applications...</td></tr>';

    const { data: interns, error } = await supabase
        .from('intern_hire')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Error loading data: ${error.message}</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    if(!interns || interns.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">No intern applications received.</td></tr>';
        return;
    }

    interns.forEach(intern => {
        let techBadges = '';
        let role = 'Unknown Role';
        
        if (Array.isArray(intern.tech_stack)) {
            intern.tech_stack.forEach(tech => {
                if(tech.startsWith('Role:')) {
                    role = tech.replace('Role: ', '');
                } else {
                    techBadges += `<span class="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded mr-1 mb-1">${tech}</span>`;
                }
            });
        }

        tbody.innerHTML += `
            <tr class="hover:bg-gray-50">
                <td class="p-4">
                    <div class="flex flex-col">
                        <span class="font-bold text-gray-800">${intern.name}</span>
                        <a href="mailto:${intern.email}" class="text-xs text-blue-600 hover:underline">${intern.email}</a>
                        <span class="text-xs text-gray-500">${intern.phone}</span>
                    </div>
                </td>
                <td class="p-4">
                    <div class="mb-1 font-semibold text-blue-700 text-sm">${role}</div>
                    <div class="flex flex-wrap max-w-xs">${techBadges}</div>
                </td>
                <td class="p-4">
                    <div class="text-sm text-gray-800 font-medium">${intern.college}</div>
                    <div class="text-xs text-gray-500">${intern.branch} • ${intern.year}</div>
                </td>
                <td class="p-4">
                    <div class="flex gap-2">
                        <a href="${intern.resume_url}" target="_blank" class="bg-blue-50 text-blue-600 px-3 py-1.5 rounded text-sm hover:bg-blue-100 border border-blue-200 flex items-center">View</a>
                        <a href="${intern.resume_url}?download=" download class="bg-gray-50 text-gray-600 px-3 py-1.5 rounded text-sm hover:bg-gray-100 border border-gray-200 flex items-center">DL</a>
                    </div>
                </td>
                <td class="p-4 text-sm text-gray-500">
                    ${new Date(intern.created_at).toLocaleDateString()}
                </td>
            </tr>
        `;
    });
}

// ============================================================
// 5. WITHDRAWALS LOGIC (NEW)
// ============================================================
async function loadWithdrawals() {
    const tbody = document.getElementById('withdrawalsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center">Loading requests...</td></tr>';

    // Fetch withdrawals + CA details + Student details (name, phone, email)
    const { data: requests, error } = await supabase
        .from('withdrawals')
        .select(`
            *,
            ca:campus_ambassadors (
                id,
                student:students ( name, email, mobile )
            )
        `)
        .order('created_at', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">Error: ${error.message}</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    if (!requests || requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-500">No pending withdrawal requests.</td></tr>';
        return;
    }

    requests.forEach(req => {
        // Status Badges
        const statusColors = {
            'pending': 'bg-yellow-100 text-yellow-700',
            'approved': 'bg-green-100 text-green-700',
            'rejected': 'bg-red-100 text-red-700'
        };
        const statusBadge = `<span class="px-2 py-1 rounded-full text-xs font-bold uppercase ${statusColors[req.status] || 'bg-gray-100'}">${req.status}</span>`;

        // Buttons
        let actions = '-';
        if (req.status === 'pending') {
            actions = `
                <div class="flex gap-2">
                    <button onclick="processWithdrawal('${req.id}', 'approved')" class="bg-green-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-green-700 transition shadow">Pay</button>
                    <button onclick="processWithdrawal('${req.id}', 'rejected', '${req.ca_id}', ${req.amount_points})" class="bg-red-100 text-red-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-red-200 transition">Reject</button>
                </div>
            `;
        } else if (req.status === 'approved') {
            actions = `<span class="text-green-600 text-xs font-bold flex items-center"><svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Paid</span>`;
        }

        tbody.innerHTML += `
            <tr class="hover:bg-gray-50 transition border-b border-gray-100 last:border-0">
                <td class="p-4">
                    <div class="flex flex-col">
                        <span class="font-bold text-gray-900">${req.ca?.student?.name || 'Unknown'}</span>
                        <span class="text-xs text-gray-500">ID: ${req.ca_id.substring(0,8)}...</span>
                    </div>
                </td>
                <td class="p-4">
                    <div class="flex flex-col text-sm">
                        <a href="mailto:${req.ca?.student?.email}" class="text-blue-600 hover:underline">${req.ca?.student?.email}</a>
                        <span class="text-gray-500">${req.ca?.student?.mobile}</span>
                    </div>
                </td>
                <td class="p-4">
                    <div class="font-bold text-gray-800">₹${req.amount_inr}</div>
                    <div class="text-xs text-gray-500">${req.amount_points} Pts</div>
                </td>
                <td class="p-4 text-sm text-gray-500">
                    ${new Date(req.created_at).toLocaleDateString()}
                </td>
                <td class="p-4">${statusBadge}</td>
                <td class="p-4">${actions}</td>
            </tr>
        `;
    });
}

window.processWithdrawal = async (id, status, caId, points) => {
    if (!confirm(`Mark this request as ${status.toUpperCase()}?`)) return;

    // 1. Update Withdrawal Status
    const { error: wError } = await supabase
        .from('withdrawals')
        .update({ status: status })
        .eq('id', id);

    if (wError) { alert("Error updating status: " + wError.message); return; }

    // 2. IF REJECTED: Refund points to CA
    if (status === 'rejected' && caId && points) {
        const { data: ca } = await supabase.from('campus_ambassadors').select('total_points').eq('id', caId).single();
        if(ca) {
            await supabase.from('campus_ambassadors')
                .update({ total_points: ca.total_points + points })
                .eq('id', caId);
            alert("Request rejected. Points refunded to CA wallet.");
        }
    } else {
        alert("Request approved. Mark as paid in your records.");
    }

    loadWithdrawals();
};

// ============================================================
// 6. TENANT CONFIG — Plan-Based Assignment & Payment Gate
// ============================================================
let _currentTenantId = null;
let _currentPaymentStatus = 'pending';

window.loadTenants = async () => {
    const list = document.getElementById('tenantsList');
    if (!list) return;
    list.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-400">Loading tenants...</td></tr>';

    const [tenantsRes, profilesRes] = await Promise.all([
        supabase.from('tenants').select('*').order('name'),
        supabase.from('user_profiles').select('id, tenant_id, subscription_plan, payment_status').eq('role', 'admin')
    ]);

    if (tenantsRes.error) {
        list.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Error: ${tenantsRes.error.message}</td></tr>`;
        return;
    }

    // Build a lookup: tenant_id → profile
    const profileMap = {};
    (profilesRes.data || []).forEach(p => { if (p.tenant_id) profileMap[p.tenant_id] = p; });

    list.innerHTML = '';
    const tenants = tenantsRes.data || [];
    if (tenants.length === 0) {
        list.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-400">No tenants registered yet.</td></tr>';
        return;
    }

    tenants.forEach(t => {
        const profile = profileMap[t.id] || {};
        const plan = profile.subscription_plan || 'free';
        const payStatus = profile.payment_status || 'unpaid';
        const payBadge = payStatus === 'paid'
            ? '<span class="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-bold">Paid ✓</span>'
            : '<span class="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-bold">Pending</span>';

        list.innerHTML += `
            <tr class="hover:bg-gray-50">
                <td class="p-4">
                    <p class="font-bold text-gray-800">${t.name}</p>
                    <p class="text-xs text-gray-400 font-mono">${t.id.substring(0,8)}...</p>
                </td>
                <td class="p-4">
                    <span class="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold uppercase">${plan}</span>
                </td>
                <td class="p-4">${payBadge}</td>
                <td class="p-4 text-center">
                    <button onclick="openTenantModal('${t.id}', '${t.name.replace(/'/g, "\\'")}')" class="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded text-sm font-semibold transition">Configure</button>
                </td>
            </tr>`;
    });
};

window.openTenantModal = async (tenantId, tenantName) => {
    _currentTenantId = tenantId;
    document.getElementById('tenantModalTitle').textContent = `Configure: ${tenantName}`;
    document.getElementById('tenantModal').classList.remove('hidden');

    // Load plans into selector
    const planSel = document.getElementById('tenantPlanSelect');
    planSel.innerHTML = '<option value="">Loading...</option>';
    const { data: plans } = await supabase.from('subscription_plans').select('name, description').order('name');
    planSel.innerHTML = '';
    (plans || []).forEach(p => {
        planSel.innerHTML += `<option value="${p.name}">${p.name} — ${p.description || ''}</option>`;
    });

    // Load existing profile data
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('subscription_plan, payment_status')
        .eq('tenant_id', tenantId)
        .maybeSingle();

    if (profile) {
        planSel.value = profile.subscription_plan || 'free';
        _currentPaymentStatus = profile.payment_status || 'unpaid';
    } else {
        _currentPaymentStatus = 'unpaid';
    }

    updatePaymentToggleUI();
    planSel.dispatchEvent(new Event('change'));
};

// Live feature preview when plan changes
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('tenantPlanSelect') && document.getElementById('tenantPlanSelect').addEventListener('change', async (e) => {
        const planName = e.target.value;
        const preview = document.getElementById('planFeaturePreview');
        if (!planName) { preview.innerHTML = '<p class="text-gray-400 italic">Select a plan to preview features.</p>'; return; }
        preview.innerHTML = '<p class="text-gray-400 text-xs animate-pulse">Loading features...</p>';
        const { data: pf } = await supabase.from('plan_features').select('feature_id').eq('plan_name', planName);
        if (!pf || pf.length === 0) {
            preview.innerHTML = '<p class="text-gray-400 italic text-sm">No features configured for this plan.</p>';
        } else {
            preview.innerHTML = pf.map(f =>
                `<div class="flex items-center gap-2"><span class="w-2 h-2 bg-green-500 rounded-full"></span><span>${f.feature_id.replace(/_/g,' ').replace(/\b\w/g,(c)=>c.toUpperCase())}</span></div>`
            ).join('');
        }
    });
});

function updatePaymentToggleUI() {
    const isPaid = _currentPaymentStatus === 'paid';
    const btn = document.getElementById('paymentToggleBtn');
    const knob = document.getElementById('paymentToggleKnob');
    const label = document.getElementById('paymentStatusLabel');
    if (!btn) return;
    btn.className = `relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none ${isPaid ? 'bg-green-500' : 'bg-gray-300'}`;
    knob.className = `inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${isPaid ? 'translate-x-6' : 'translate-x-1'}`;
    label.textContent = isPaid ? 'PAID' : 'PENDING';
    label.className = `text-xs font-bold ${isPaid ? 'text-green-600' : 'text-yellow-600'}`;
}

window.togglePaymentStatus = () => {
    _currentPaymentStatus = _currentPaymentStatus === 'paid' ? 'unpaid' : 'paid';
    updatePaymentToggleUI();
};

window.saveTenantConfig = async () => {
    if (!_currentTenantId) return;
    const plan = document.getElementById('tenantPlanSelect').value;
    if (!plan) return alert('Please select a plan.');

    const { error } = await supabase.from('user_profiles').update({
        subscription_plan: plan,
        payment_status: _currentPaymentStatus
    }).eq('tenant_id', _currentTenantId);

    if (error) { alert('Error saving: ' + error.message); return; }
    closeTenantModal();
    const statusMsg = _currentPaymentStatus === 'paid' ? 'Dashboard is now LIVE for this mess! ✅' : 'Plan assigned. Dashboard pending payment.';
    alert(statusMsg);
};

window.closeTenantModal = () => {
    document.getElementById('tenantModal').classList.add('hidden');
    _currentTenantId = null;
    loadTenants();
};

// ============================================================
// 7. PLAN MANAGEMENT — Create & Configure Plans (incl. customv1)
// ============================================================
window.loadPlanManagement = async () => {
    const container = document.getElementById('plansList');
    if (!container) return;
    container.innerHTML = '<p class="text-gray-400 text-center py-8">Loading plans...</p>';

    const [plansRes, planFeaturesRes, allFeaturesRes] = await Promise.all([
        supabase.from('subscription_plans').select('*').order('price_monthly', { ascending: true, nullsFirst: false }),
        supabase.from('plan_features').select('*'),
        supabase.from('features').select('*')
    ]);

    if (plansRes.error) {
        container.innerHTML = `<p class="text-red-500">Error: ${plansRes.error.message}</p>`; return;
    }

    const plans = plansRes.data || [];
    if (plans.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 border-2 border-dashed border-gray-100 rounded-xl">
                <p class="text-gray-400">No custom plans found. Seed the database or create one!</p>
            </div>`;
        return;
    }

    const planFeatureMap = {};
    (planFeaturesRes.data || []).forEach(pf => {
        if (!planFeatureMap[pf.plan_name]) planFeatureMap[pf.plan_name] = [];
        planFeatureMap[pf.plan_name].push(pf.feature_id);
    });

    container.innerHTML = '';
    plans.forEach(plan => {
        const features = planFeatureMap[plan.name] || [];
        const isCustomType = !['free','starter','pro'].includes(plan.name);
        const featureBadges = features.map(f =>
            `<span class="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">${f.replace(/_/g,' ')}</span>`
        ).join(' ') || '<span class="text-gray-400 text-xs italic">No features</span>';

        container.innerHTML += `
            <div class="border rounded-xl p-5 hover:border-blue-300 transition ${isCustomType ? 'border-purple-200 bg-purple-50' : 'border-gray-200 bg-white'}">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-gray-800 text-base">${plan.name}</span>
                            ${isCustomType ? '<span class="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-semibold">Custom</span>' : ''}
                        </div>
                        <p class="text-sm text-gray-500 mt-0.5">${plan.description || '—'}</p>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-gray-800">${plan.price_monthly === null ? 'Custom Price' : (plan.price_monthly === 0 ? 'Free' : '₹'+plan.price_monthly+'/mo')}</p>
                        <button onclick="openEditPlanModal('${plan.name}')" class="text-xs text-blue-600 hover:underline mt-1">Edit Features</button>
                    </div>
                </div>
                <div class="flex flex-wrap gap-1">${featureBadges}</div>
            </div>`;
    });
};

window.openNewPlanModal = async () => {
    document.getElementById('newPlanName').value = '';
    document.getElementById('newPlanName').readOnly = false;
    document.getElementById('newPlanDesc').value = '';
    document.getElementById('newPlanPrice').value = '';
    await loadFeatureCheckboxes('newPlanFeatureList', []);
    document.getElementById('newPlanModal').classList.remove('hidden');
};

window.openEditPlanModal = async (planName) => {
    document.getElementById('newPlanName').value = planName;
    document.getElementById('newPlanName').readOnly = true;
    const { data: plan } = await supabase.from('subscription_plans').select('*').eq('name', planName).maybeSingle();
    document.getElementById('newPlanDesc').value = plan?.description || '';
    document.getElementById('newPlanPrice').value = plan?.price_monthly || '';
    const { data: pf } = await supabase.from('plan_features').select('feature_id').eq('plan_name', planName);
    const enabled = (pf || []).map(f => f.feature_id);
    await loadFeatureCheckboxes('newPlanFeatureList', enabled);
    document.getElementById('newPlanModal').classList.remove('hidden');
};

async function loadFeatureCheckboxes(containerId, enabledList) {
    const container = document.getElementById(containerId);
    container.innerHTML = '<p class="text-xs text-gray-400">Loading...</p>';
    const { data: features } = await supabase.from('features').select('*');
    container.innerHTML = '';
    (features || []).forEach(f => {
        const checked = enabledList.includes(f.id) ? 'checked' : '';
        container.innerHTML += `
            <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" value="${f.id}" ${checked} class="plan-feature-checkbox w-4 h-4 accent-purple-600">
                <div>
                    <span class="text-sm font-medium text-gray-700">${f.name}</span>
                    <p class="text-xs text-gray-400">${f.description || ''}</p>
                </div>
            </label>`;
    });
}

window.closeNewPlanModal = () => {
    document.getElementById('newPlanModal').classList.add('hidden');
    document.getElementById('newPlanName').readOnly = false;
};

window.saveNewPlan = async () => {
    const name = document.getElementById('newPlanName').value.trim().toLowerCase().replace(/\s+/g,'');
    const desc = document.getElementById('newPlanDesc').value.trim();
    const price = parseFloat(document.getElementById('newPlanPrice').value) || null;

    if (!name) return alert('Plan name is required.');

    // Upsert the plan
    const { error: planErr } = await supabase.from('subscription_plans').upsert(
        { name, description: desc, price_monthly: price, updated_at: new Date().toISOString() },
        { onConflict: 'name' }
    );
    if (planErr) { alert('Error saving plan: ' + planErr.message); return; }

    // Get selected feature IDs
    const checked = [...document.querySelectorAll('.plan-feature-checkbox:checked')].map(cb => cb.value);

    // Delete old features for this plan, then insert new ones
    await supabase.from('plan_features').delete().eq('plan_name', name);
    if (checked.length > 0) {
        const inserts = checked.map(fId => ({ plan_name: name, feature_id: fId }));
        const { error: featureErr } = await supabase.from('plan_features').insert(inserts);
        if (featureErr) { alert('Plan saved but features error: ' + featureErr.message); }
    }

    closeNewPlanModal();
    alert(`Plan "${name}" saved successfully!`);
    loadPlanManagement();
};

// ============================================================
// 8. INTERNSHIP ROLES MANAGEMENT (CRUD)
// ============================================================
window.loadInternships = async () => {
    const list = document.getElementById('internshipsList');
    if (!list) return;
    list.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-400">Loading internships...</td></tr>';

    const { data: internships, error } = await supabase
        .from('internships')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        list.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Error: ${error.message}</td></tr>`;
        return;
    }

    list.innerHTML = '';
    if (!internships || internships.length === 0) {
        list.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-400">No internship roles defined.</td></tr>';
        return;
    }

    internships.forEach(item => {
        const statusBadge = item.is_active 
            ? '<span class="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-bold">Active</span>'
            : '<span class="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full font-bold">Closed</span>';

        const techBadges = (item.tech_stack || []).map(t => `<span class="bg-blue-50 text-blue-600 text-[10px] px-1.5 py-0.5 rounded border border-blue-100 mr-1 mb-1 inline-block">${t}</span>`).join('');

        list.innerHTML += `
            <tr class="hover:bg-gray-50 group">
                <td class="p-4">
                    <p class="font-bold text-gray-800">${item.title}</p>
                    <p class="text-xs text-gray-400 font-mono">${item.id.substring(0,8)}...</p>
                </td>
                <td class="p-4">
                    <p class="text-sm text-gray-600 line-clamp-1 mb-1">${item.description}</p>
                    <div class="flex flex-wrap">${techBadges}</div>
                </td>
                <td class="p-4 text-center">${statusBadge}</td>
                <td class="p-4 text-center">
                    <div class="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="editInternship('${item.id}')" class="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-2 rounded">Edit</button>
                        <button onclick="deleteInternship('${item.id}')" class="text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 p-2 rounded">Delete</button>
                    </div>
                </td>
            </tr>`;
    });
};

window.openInternshipModal = () => {
    document.getElementById('internshipId').value = '';
    document.getElementById('internshipForm').reset();
    document.getElementById('internshipModalTitle').textContent = 'Create Internship Role';
    document.getElementById('internshipModal').classList.remove('hidden');
};

window.closeInternshipModal = () => {
    document.getElementById('internshipModal').classList.add('hidden');
};

window.editInternship = async (id) => {
    const { data, error } = await supabase.from('internships').select('*').eq('id', id).single();
    if (error) return alert(error.message);

    document.getElementById('internshipId').value = data.id;
    document.getElementById('internTitle').value = data.title;
    document.getElementById('internDesc').value = data.description;
    document.getElementById('internResponsibilities').value = (data.responsibilities || []).join('\n');
    document.getElementById('internTechStack').value = (data.tech_stack || []).join('\n');
    document.getElementById('internIconType').value = data.icon_type;
    document.getElementById('internIconColor').value = data.icon_color;
    document.getElementById('internBgColor').value = data.bg_color;
    document.getElementById('internIsActive').checked = data.is_active;

    document.getElementById('internshipModalTitle').textContent = 'Edit Internship Role';
    document.getElementById('internshipModal').classList.remove('hidden');
};

window.saveInternship = async () => {
    const id = document.getElementById('internshipId').value;
    const title = document.getElementById('internTitle').value.trim();
    const description = document.getElementById('internDesc').value.trim();
    const responsibilities = document.getElementById('internResponsibilities').value.trim().split('\n').filter(r => r.trim());
    const tech_stack = document.getElementById('internTechStack').value.trim().split('\n').filter(t => t.trim());
    const icon_type = document.getElementById('internIconType').value;
    const icon_color = document.getElementById('internIconColor').value.trim();
    const bg_color = document.getElementById('internBgColor').value.trim();
    const is_active = document.getElementById('internIsActive').checked;

    if (!title || !description) return alert('Title and Description are required.');

    const payload = { title, description, responsibilities, tech_stack, icon_type, icon_color, bg_color, is_active };

    let error;
    if (id) {
        const { error: err } = await supabase.from('internships').update(payload).eq('id', id);
        error = err;
    } else {
        const { error: err } = await supabase.from('internships').insert(payload);
        error = err;
    }

    if (error) {
        alert('Error saving: ' + error.message);
    } else {
        closeInternshipModal();
        loadInternships();
        alert('Internship role saved successfully!');
    }
};

window.deleteInternship = async (id) => {
    if (!confirm('Are you sure you want to delete this role?')) return;
    const { error } = await supabase.from('internships').delete().eq('id', id);
    if (error) alert(error.message);
    else loadInternships();
};

// ── Logout ──────────────────────────────────────────────────────────
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    });
}

// ── Init ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    checkAuth().then(() => switchTab('applicants'));
});