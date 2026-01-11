import { supabase } from '../supabaseConfig.js';

const form = document.getElementById('internForm');
const submitBtn = document.getElementById('submitBtn');
const alertBox = document.getElementById('alertBox');

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
            const roleSelection = roleSelect ? roleSelect.value : '';

            // Collect Tech Stack Checkboxes
            let techStack = Array.from(document.querySelectorAll('input[name="techstack"]:checked'))
                .map(cb => cb.value);

            // Add Role to Tech Stack array for reference
            if(roleSelection) {
                techStack.unshift(`Role: ${roleSelection}`);
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