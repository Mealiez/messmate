import { supabase } from '../supabaseConfig.js';

let currentCAId = null;
let currentStudentId = null;

async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = 'login.html'; return; }

    // 1. Get CA Details
    // Link user -> student -> campus_ambassador
    const { data: student } = await supabase.from('students').select('id').eq('user_id', user.id).single();
    if(!student) { alert('Student profile not found'); return; }

    currentStudentId = student.id;

    const { data: ca, error } = await supabase.from('campus_ambassadors')
        .select('*')
        .eq('student_id', student.id)
        .eq('status', 'approved') // Security check
        .single();

    if (error || !ca) {
        alert("Access Denied: You are not an approved Campus Ambassador.");
        window.location.href = 'student-dashboard.html';
        return;
    }

    currentCAId = ca.id;
    
    // Update Points UI
    document.getElementById('caPoints').textContent = ca.total_points;
    
    // Progress Bar (Assuming 1000 is the big milestone)
    const progress = Math.min((ca.total_points / 1000) * 100, 100);
    const progressEl = document.getElementById('pointsProgress');
    if(progressEl) progressEl.style.width = `${progress}%`;

    // Load Data
    await loadRankStats(ca.total_points); // <--- NEW DYNAMIC RANK FUNCTION
    loadTasks();
    loadHistory();
}

// --- NEW: DYNAMIC RANKING ALGORITHM ---
async function loadRankStats(myPoints) {
    try {
        // 1. Fetch ALL Ambassadors (ID and Points only) to calculate position
        const { data: allCas, error } = await supabase
            .from('campus_ambassadors')
            .select('student_id, total_points')
            .eq('status', 'approved') // Only compare with active CAs
            .order('total_points', { ascending: false }); // Highest points first

        if (error) throw error;

        // 2. Find Current User's Position
        // rankIndex is 0-based (0 is 1st place), so we add 1
        const rankIndex = allCas.findIndex(ca => ca.student_id === currentStudentId);
        
        if (rankIndex === -1) {
            document.getElementById('caRank').textContent = "N/A";
            return;
        }

        const myRank = rankIndex + 1;
        const totalParticipants = allCas.length;

        // 3. Update Rank Text
        document.getElementById('caRank').textContent = `#${myRank}`;

        // 4. Calculate Percentile (Top X%)
        // Example: Rank 5 out of 50 -> (5/50)*100 = Top 10%
        let topPercent = Math.ceil((myRank / totalParticipants) * 100);
        
        // 5. Update the "Percentile" Badge text if it exists
        // (You need to add a <span id="rankPercentile"> tag in your HTML to see this)
        const badgeEl = document.getElementById('rankPercentile');
        if (badgeEl) {
            if (myRank === 1) {
                badgeEl.textContent = "🏆 Top 1% (Leader)";
                badgeEl.className = "text-yellow-600 text-xs font-bold bg-yellow-100 px-2 py-1 rounded-full mt-2 inline-block";
            } else {
                badgeEl.textContent = `Top ${topPercent}% of CAs`;
                badgeEl.className = "text-green-600 text-xs font-bold bg-green-100 px-2 py-1 rounded-full mt-2 inline-block";
            }
        }

    } catch (err) {
        console.error("Error calculating rank:", err);
    }
}

async function loadTasks() {
    const { data: tasks } = await supabase.from('ca_tasks').select('*');
    const select = document.getElementById('taskSelect');
    if(!select) return;

    select.innerHTML = '<option value="" disabled selected>Select a task...</option>';
    
    tasks.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = `${t.title} (${t.default_points} pts)`;
        opt.dataset.desc = t.description;
        select.appendChild(opt);
    });

    select.addEventListener('change', (e) => {
        const desc = e.target.options[e.target.selectedIndex].dataset.desc;
        const descEl = document.getElementById('taskDesc');
        if(descEl) descEl.textContent = desc;
    });
}

async function loadHistory() {
    const tbody = document.getElementById('historyTable');
    if(!tbody) return;

    const { data: subs } = await supabase.from('ca_submissions')
        .select('*, ca_tasks(title)')
        .eq('ca_id', currentCAId)
        .order('submitted_at', { ascending: false });

    tbody.innerHTML = '';
    subs.forEach(s => {
        const statusColors = { 
            'pending': 'text-yellow-600 bg-yellow-100', 
            'approved': 'text-green-600 bg-green-100', 
            'rejected': 'text-red-600 bg-red-100' 
        };
        
        const taskTitle = s.ca_tasks ? s.ca_tasks.title : 'Unknown Task';
        
        tbody.innerHTML += `
            <tr class="border-b last:border-0">
                <td class="py-3 font-medium text-gray-800">${taskTitle}</td>
                <td class="py-3 text-gray-500">${new Date(s.submitted_at).toLocaleDateString()}</td>
                <td class="py-3"><span class="px-2 py-1 rounded text-xs font-bold ${statusColors[s.status]}">${s.status.toUpperCase()}</span></td>
                <td class="py-3 text-right font-bold ${s.points_awarded > 0 ? 'text-green-600' : 'text-gray-400'}">
                    ${s.points_awarded > 0 ? '+' : ''}${s.points_awarded}
                </td>
            </tr>
        `;
    });
}

const subForm = document.getElementById('submissionForm');
if(subForm) {
    subForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submitBtn');
        btn.disabled = true;
        btn.textContent = 'Uploading...';

        try {
            const taskId = document.getElementById('taskSelect').value;
            const file = document.getElementById('reportFile').files[0];
            
            if(!file || !taskId) throw new Error("Please fill all fields");

            // Upload
            const fileExt = file.name.split('.').pop();
            const fileName = `${currentCAId}_${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('ca_reports').upload(fileName, file);
            if(uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('ca_reports').getPublicUrl(fileName);

            // Record DB
            const { error: dbError } = await supabase.from('ca_submissions').insert({
                ca_id: currentCAId,
                task_id: taskId,
                report_url: publicUrl
            });
            if(dbError) throw dbError;

            alert('Task submitted successfully!');
            document.getElementById('taskModal').classList.add('hidden');
            e.target.reset();
            loadHistory();

        } catch (err) {
            alert(err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Submit Report';
        }
    });
}

init();