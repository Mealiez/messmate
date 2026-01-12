import { supabase } from '../supabaseConfig.js';

// --- AUTH CHECK ---
async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = 'login.html'; return; }
    
    // Check Role via RPC function to avoid recursion
    const { data: isAuthorized, error } = await supabase.rpc('is_hr_or_admin');
    
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
        'interns': 'Intern Applications'
    };
    const titleEl = document.getElementById('pageTitle');
    if(titleEl) titleEl.textContent = titles[tab] || 'Dashboard';

    if(tab === 'applicants') loadApplicants();
    if(tab === 'submissions') loadSubmissions();
    if(tab === 'tasks') loadTasks();
    if(tab === 'interns') loadInterns();
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

// --- LOGOUT ---
const logoutBtn = document.getElementById('logoutBtn');
if(logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    checkAuth().then(() => switchTab('applicants'));
});