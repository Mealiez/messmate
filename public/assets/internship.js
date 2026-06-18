import { supabase } from '../supabaseConfig.js';

const form = document.getElementById('internForm');
const submitBtn = document.getElementById('submitBtn');
const alertBox = document.getElementById('alertBox');
const rolesContainer = document.getElementById('rolesContainer');
const roleSelection = document.getElementById('roleSelection');
const techStackContainer = document.getElementById('techStackContainer');

let availableInternships = [];

// Icons Map
const iconMap = {
    'code': '<svg class="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>',
    'design': '<svg class="h-8 w-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path></svg>',
    'database': '<svg class="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg>',
    'marketing': '<svg class="h-8 w-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.001 0 01-1.564-.317z"></path></svg>'
};

async function loadDynamicInternships() {
    try {
        const { data, error } = await supabase
            .from('internships')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: true });

        if (error) throw error;
        availableInternships = data || [];

        renderRoles();
        renderRoleOptions();
    } catch (err) {
        console.error("Error loading internships:", err);
        if(rolesContainer) rolesContainer.innerHTML = '<p class="col-span-full text-center text-red-500">Failed to load roles.</p>';
    }
}

function renderRoles() {
    if(!rolesContainer) return;
    rolesContainer.innerHTML = '';

    if(availableInternships.length === 0) {
        rolesContainer.innerHTML = '<p class="col-span-full text-center text-gray-500 py-12">No open positions at the moment. Check back later!</p>';
        return;
    }

    availableInternships.forEach((item, index) => {
        const delay = (index + 1) * 100;
        const icon = iconMap[item.icon_type] || iconMap['code'];
        
        rolesContainer.innerHTML += `
            <div class="glass-card rounded-2xl shadow-xl p-8 hover:shadow-2xl transition transform hover:-translate-y-2" data-aos="fade-up" data-aos-delay="${delay}">
                <div class="${item.bg_color || 'bg-blue-100'} w-14 h-14 rounded-lg flex items-center justify-center mb-6">
                    ${icon}
                </div>
                <h3 class="text-2xl font-bold text-gray-800 mb-2">${item.title}</h3>
                <p class="text-gray-600 mb-6 line-clamp-2">${item.description}</p>
                <div class="flex gap-4">
                    <button onclick="openModal('${item.id}')" class="flex-1 bg-white border-2 border-slate-600 text-slate-600 py-2 rounded-lg font-semibold hover:bg-slate-50 transition">Details</button>
                    <button onclick="window.showForm('${item.title}')" class="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition">Apply Now</button>
                </div>
            </div>`;
    });
}

function renderRoleOptions() {
    if(!roleSelection) return;
    roleSelection.innerHTML = '<option value="" disabled selected>Select a Role</option>';
    availableInternships.forEach(item => {
        roleSelection.innerHTML += `<option value="${item.title}">${item.title}</option>`;
    });
}

function updateTechStackCheckboxes(roleTitle) {
    if(!techStackContainer) return;
    const role = availableInternships.find(r => r.title === roleTitle);
    
    if(!role || !role.tech_stack || role.tech_stack.length === 0) {
        techStackContainer.innerHTML = '<p class="text-gray-400 italic text-sm col-span-full">No specific tech stack requirements listed.</p>';
        return;
    }

    techStackContainer.innerHTML = role.tech_stack.map(tech => `
        <label class="flex items-center space-x-2 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
            <input type="checkbox" name="techstack" value="${tech}" class="w-5 h-5 text-blue-600 rounded focus:ring-blue-500">
            <span class="text-gray-700">${tech}</span>
        </label>
    `).join('');
}

// Global hook for showForm to also update tech stack
const originalShowForm = window.showForm;
window.showForm = (role) => {
    if(typeof originalShowForm === 'function') originalShowForm(role);
    if(role) updateTechStackCheckboxes(role);
};

if(roleSelection) {
    roleSelection.addEventListener('change', (e) => {
        updateTechStackCheckboxes(e.target.value);
    });
}

// Handle Custom Event from HTML Script
window.addEventListener('open-job-modal', (e) => {
    const id = e.detail.id;
    const item = availableInternships.find(i => i.id === id);
    if(!item) return;

    const modalContent = document.getElementById('modalContent');
    const modal = document.getElementById('jobModal');
    
    window.currentRoleForModal = item.title;

    modalContent.innerHTML = `
        <div class="flex items-center mb-4">
            <div class="${item.bg_color} p-3 rounded-lg mr-4">
                <svg class="h-6 w-6 ${item.icon_color}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
            </div>
            <h3 class="text-2xl font-bold text-gray-800">${item.title}</h3>
        </div>
        <p class="text-gray-600 mb-4">${item.description}</p>
        <h4 class="font-semibold text-gray-800 mb-2">Key Responsibilities:</h4>
        <ul class="list-disc list-inside space-y-2 text-gray-600 text-sm">
            ${(item.responsibilities || []).map(p => `<li>${p}</li>`).join('')}
        </ul>
    `;
    modal.classList.remove('hidden');
});

// Initialize
loadDynamicInternships();

// Helper function to show messages
function showApplicationAlert(message, type) {
    if (!alertBox) return; 
    alertBox.textContent = message;
    alertBox.className = `mb-6 p-4 rounded-lg ${type === 'success' ? 'bg-green-100 text-green-700 border border-green-400' : 'bg-red-100 text-red-700 border border-red-400'}`;
    alertBox.classList.remove('hidden');
    // Auto hide after 5 seconds
    setTimeout(() => alertBox.classList.add('hidden'), 5000);
}

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault(); // STOP THE PAGE RELOAD
        
        submitBtn.disabled = true;
        const originalBtnText = submitBtn.textContent;
        submitBtn.textContent = 'Uploading & Submitting...';
        alertBox.classList.add('hidden');

        try {
            // 1. Collect Form Data
            const name = document.getElementById('name').value;
            const phone = document.getElementById('phone').value;
            const email = document.getElementById('email').value;
            const college = document.getElementById('college').value;
            const year = document.getElementById('year').value;
            const branch = document.getElementById('branch').value;
            
            // Get Role Selection (Dropdown)
            const roleSelect = document.getElementById('roleSelection');
            const roleSelectionValue = roleSelect ? roleSelect.value : '';

            // Collect Tech Stack Checkboxes
            let techStack = Array.from(document.querySelectorAll('input[name="techstack"]:checked'))
                .map(cb => cb.value);

            // Add Role to Tech Stack array for reference
            if(roleSelectionValue) {
                techStack.unshift(`Role: ${roleSelectionValue}`);
            }

            // 2. Validate File
            const resumeInput = document.getElementById('resume');
            const resumeFile = resumeInput.files[0];
            if (!resumeFile) throw new Error("Please upload your resume (PDF).");

            // 3. Upload File to Supabase Storage
            // Create unique file name: timestamp_sanitized-name.pdf
            const fileExt = resumeFile.name.split('.').pop();
            const fileName = `${Date.now()}_${name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.${fileExt}`;

            const { data: fileUploadData, error: fileError } = await supabase.storage
                .from('resumes')
                .upload(fileName, resumeFile);

            if (fileError) throw new Error("Resume upload failed: " + fileError.message);

            // 4. Get Public URL for the file
            const { data: urlData } = supabase.storage
                .from('resumes')
                .getPublicUrl(fileName);
            
            const publicUrl = urlData.publicUrl;

            // 5. Insert Data into Database
            const { error: dbError } = await supabase
                .from('intern_hire')
                .insert({
                    name,
                    phone,
                    email,
                    college,
                    year,
                    branch,
                    tech_stack: techStack,
                    resume_url: publicUrl
                });

            if (dbError) throw new Error("Database error: " + dbError.message);

            // 6. Success
            showApplicationAlert("Application submitted successfully! We will contact you soon.", "success");
            form.reset();
            document.getElementById('fileNameDisplay').textContent = '';
            
            // Scroll to top to see message
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (error) {
            console.error("Submission Error:", error);
            showApplicationAlert(error.message || "An unknown error occurred", "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText; // Restore button text
        }
    });
} else {
    console.error("Internship Form not found in DOM");
}