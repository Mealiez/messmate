import { supabase } from '../supabaseConfig.js';

const form = document.getElementById('internForm');
const submitBtn = document.getElementById('submitBtn');
const alertBox = document.getElementById('alertBox');

function showAlert(message, type) {
    alertBox.textContent = message;
    alertBox.className = `mb-6 p-4 rounded-lg ${type === 'success' ? 'bg-green-100 text-green-700 border border-green-400' : 'bg-red-100 text-red-700 border border-red-400'}`;
    alertBox.classList.remove('hidden');
    // Auto hide after 5 seconds
    setTimeout(() => alertBox.classList.add('hidden'), 5000);
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading & Submitting...';
    alertBox.classList.add('hidden');

    try {
        // 1. Collect Data
        const name = document.getElementById('name').value;
        const phone = document.getElementById('phone').value;
        const email = document.getElementById('email').value;
        const college = document.getElementById('college').value;
        const year = document.getElementById('year').value;
        const branch = document.getElementById('branch').value;
        
        // Collect Checkboxes
        const techStack = Array.from(document.querySelectorAll('input[name="techstack"]:checked'))
            .map(cb => cb.value);

        // 2. Handle File Upload
        const resumeFile = document.getElementById('resume').files[0];
        if (!resumeFile) throw new Error("Please upload your resume.");
        
        // Create unique file name: timestamp_sanitized-name.pdf
        const fileExt = resumeFile.name.split('.').pop();
        const fileName = `${Date.now()}_${name.replace(/\s+/g, '-').toLowerCase()}.${fileExt}`;
        const filePath = `resumes/${fileName}`;

        const { data: fileData, error: fileError } = await supabase.storage
            .from('resumes')
            .upload(fileName, resumeFile);

        if (fileError) throw new Error("Resume upload failed: " + fileError.message);

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('resumes')
            .getPublicUrl(fileName);

        // 3. Insert into Database
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

        // Success
        showAlert("Application submitted successfully! We will contact you soon.", "success");
        form.reset();
        document.getElementById('fileNameDisplay').textContent = '';
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error(error);
        showAlert(error.message, "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Application';
    }
});
function showAlert(message, type) {
    alertBox.textContent = message;
    alertBox.className = `mb-6 p-4 rounded-lg ${type === 'success' ? 'bg-green-100 text-green-700 border border-green-400' : 'bg-red-100 text-red-700 border border-red-400'}`;
    alertBox.classList.remove('hidden');
    setTimeout(() => alertBox.classList.add('hidden'), 5000);
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading & Submitting...';
    alertBox.classList.add('hidden');

    try {
        const name = document.getElementById('name').value;
        const phone = document.getElementById('phone').value;
        const email = document.getElementById('email').value;
        const college = document.getElementById('college').value;
        const year = document.getElementById('year').value;
        const branch = document.getElementById('branch').value;
        
        // NEW: Get the selected Role (if any)
        const roleSelection = document.getElementById('roleSelection').value;
        
        // Collect Tech Stack Checkboxes
        let techStack = Array.from(document.querySelectorAll('input[name="techstack"]:checked'))
            .map(cb => cb.value);

        // Append the role to techstack array or save it in tech_stack text for context
        if(roleSelection) {
            techStack.unshift(`Role: ${roleSelection}`);
        }

        const resumeFile = document.getElementById('resume').files[0];
        if (!resumeFile) throw new Error("Please upload your resume.");
        
        const fileExt = resumeFile.name.split('.').pop();
        const fileName = `${Date.now()}_${name.replace(/\s+/g, '-').toLowerCase()}.${fileExt}`;

        const { error: fileError } = await supabase.storage
            .from('resumes')
            .upload(fileName, resumeFile);

        if (fileError) throw new Error("Resume upload failed: " + fileError.message);

        const { data: { publicUrl } } = supabase.storage
            .from('resumes')
            .getPublicUrl(fileName);

        const { error: dbError } = await supabase
            .from('intern_hire')
            .insert({
                name,
                phone,
                email,
                college,
                year,
                branch,
                tech_stack: techStack, // This now includes the Role as the first item
                resume_url: publicUrl
            });

        if (dbError) throw new Error("Database error: " + dbError.message);

        showAlert("Application submitted successfully! We will contact you soon.", "success");
        form.reset();
        document.getElementById('fileNameDisplay').textContent = '';
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error(error);
        showAlert(error.message, "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Application';
    }
});