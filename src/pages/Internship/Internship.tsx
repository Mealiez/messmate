import React, { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Code, Boxes, Send, Trophy, ArrowRight, X } from 'lucide-react';

const roleDetails = {
  uiux: {
    key: 'UI/UX Designer',
    color: 'purple',
    icon: <Palette className="w-8 h-8 text-purple-600" />,
    description: 'Design intuitive interfaces and user experiences for our web and mobile platforms.',
    fullDescription: 'We are looking for a creative UI/UX designer to craft intuitive and beautiful interfaces for our mess management system.',
    points: [
      'Design wireframes, prototypes, and high-fidelity mockups using Figma.',
      'Collaborate with developers to ensure accurate implementation.',
      'Conduct user research to improve UX flow.',
      'Create responsive designs for Mobile and Web.',
    ],
  },
  react: {
    key: 'React Developer',
    color: 'blue',
    icon: <Code className="w-8 h-8 text-blue-600" />,
    description: 'Build responsive and dynamic frontend components using React, Tailwind, and Vite.',
    fullDescription: 'Join our frontend team to build a fast, responsive, and interactive dashboard for students and admins.',
    points: [
      'Develop reusable components using React.js and TypeScript.',
      'Style applications using Tailwind CSS.',
      'Integrate APIs and handle state management.',
      'Optimize application performance and fix bugs.',
    ],
  },
  backend: {
    key: 'Backend Developer',
    color: 'green',
    icon: <Boxes className="w-8 h-8 text-green-600" />,
    description: 'Manage database architecture, API integration, and server-side logic with Supabase.',
    fullDescription: 'Help us scale our backend infrastructure and manage secure data flow using Supabase and SQL.',
    points: [
      'Design and maintain PostgreSQL database schemas.',
      'Write optimized SQL queries and RLS policies.',
      'Manage Authentication and Edge Functions.',
      'Ensure data security and system reliability.',
    ],
  },
};

type RoleKey = keyof typeof roleDetails;

const techOptions = ['React JS', 'Node.js', 'Supabase / SQL', 'Tailwind CSS', 'Figma / Adobe XD', 'Python'];

const Internship: React.FC = () => {
  const [view, setView] = useState<'roles' | 'form'>('roles');
  const [selectedRole, setSelectedRole] = useState('');
  const [modal, setModal] = useState<RoleKey | null>(null);
  const [selectedTech, setSelectedTech] = useState<string[]>([]);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const showForm = (role: string) => { 
    setSelectedRole(role); 
    setView('form'); 
    setModal(null); 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const showRoles = () => {
    setView('roles');
    setSuccess(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleTech = (tech: string) => {
    setSelectedTech(prev => prev.includes(tech) ? prev.filter(t => t !== tech) : [...prev, tech]);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!resumeFile) { setError('Please upload a resume.'); return; }
    setSubmitting(true);
    setError('');

    const form = e.currentTarget;
    const name = (form.elements.namedItem('name') as HTMLInputElement).value;
    const phone = (form.elements.namedItem('phone') as HTMLInputElement).value;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const year = (form.elements.namedItem('year') as HTMLSelectElement).value;
    const college = (form.elements.namedItem('college') as HTMLInputElement).value;
    const branch = (form.elements.namedItem('branch') as HTMLInputElement).value;
    const role = (form.elements.namedItem('roleSelection') as HTMLSelectElement).value;

    try {
      const fileName = `intern-resumes/${Date.now()}-${resumeFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from('intern-resumes').upload(fileName, resumeFile);
      if (uploadError) throw new Error('Resume upload failed: ' + uploadError.message);
      const { data: { publicUrl } } = supabase.storage.from('intern-resumes').getPublicUrl(uploadData.path);

      const techStack = [...selectedTech, `Role: ${role}`];

      const { error: insertError } = await supabase.from('intern_hire').insert({ 
          name, 
          phone, 
          email, 
          year, 
          college, 
          branch, 
          tech_stack: techStack, 
          resume_url: publicUrl 
      });
      if (insertError) throw new Error(insertError.message);

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-50 font-sans antialiased min-h-screen text-gray-800">
      
      {/* Navbar - Matching Legacy Design */}
      <nav className="bg-white shadow-lg fixed w-full top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <a href="/index.html" className="flex items-center">
                <img src="/assets/logo.png" alt="Mealiez" className="h-8 w-8" />
                <span className="ml-2 text-xl font-bold text-orange-600">Mealiez</span>
              </a>
            </div>
            <div className="flex items-center">
              <a href="/index.html" className="text-gray-700 hover:text-blue-600 transition font-medium">Back to Home</a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white pt-32 pb-20 text-center">
        <motion.h1 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="text-4xl md:text-5xl font-bold mb-4"
        >
            Join Our Team
        </motion.h1>
        <motion.p 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.1 }} 
            className="text-blue-100 text-lg max-w-2xl mx-auto px-4"
        >
          Kickstart your career with Mealiez. We are looking for passionate interns to build the future of mess management.
        </motion.p>
      </div>

      <AnimatePresence mode="wait">
        {view === 'roles' && (
          <motion.section 
            key="roles" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 -mt-10 relative z-10"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {(Object.entries(roleDetails) as [RoleKey, typeof roleDetails.uiux][]).map(([key, role]) => (
                <div key={key} className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition transform hover:-translate-y-2 border border-blue-50/50">
                  <div className={`bg-${role.color}-100 w-14 h-14 rounded-lg flex items-center justify-center mb-6`}>
                    {role.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">{role.key}</h3>
                  <p className="text-gray-600 mb-6">{role.description}</p>
                  <div className="flex gap-4">
                    <button 
                        onClick={() => setModal(key)} 
                        className={`flex-1 bg-white border-2 border-${role.color}-600 text-${role.color}-600 py-2 rounded-lg font-semibold hover:bg-${role.color}-50 transition shadow-sm`}
                    >
                        Details
                    </button>
                    <button 
                        onClick={() => showForm(role.key)} 
                        className={`flex-1 bg-${role.color}-600 text-white py-2 rounded-lg font-semibold hover:bg-${role.color}-700 transition shadow-md`}
                    >
                        Apply Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {view === 'form' && (
          <motion.section 
            key="form" 
            initial={{ opacity: 0, scale: 0.98 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0 }}
            className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 pt-8 -mt-10 relative z-10"
          >
            <button onClick={showRoles} className="mb-6 flex items-center text-gray-600 hover:text-blue-600 font-semibold transition">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                Back to Roles
            </button>

            {success ? (
              <div className="bg-white rounded-xl shadow-xl p-12 text-center animate-fade-in border border-green-100">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Application Submitted!</h2>
                <p className="text-gray-600 mb-8 max-w-md mx-auto italic">Thank you for applying to Mealiez. Our HR team will review your application and contact you via email soon.</p>
                <button 
                    onClick={showRoles} 
                    className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 shadow-lg transition"
                >
                    Back to Roles
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-xl p-8 border border-gray-100">
                <div className="text-center mb-10">
                  <h2 className="text-3xl font-bold text-gray-900">Application Form</h2>
                  <p className="text-gray-500 mt-2">Personal & Academic Information</p>
                </div>

                {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-8 font-medium">⚠️ {error}</div>}

                <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                        <input name="name" required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="John Doe" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                        <input name="phone" type="tel" required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="+91 9876543210" />
                    </div>
                  </div>
                  
                  <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                      <input name="email" type="email" required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="john@example.com" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Year</label>
                        <select name="year" required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium">
                            <option value="">Select Year</option>
                            {['1st Year', '2nd Year', '3rd Year', '4th Year', 'Graduate'].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">College Name</label>
                        <input name="college" required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="Your University..." />
                    </div>
                  </div>

                  <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Branch / Stream</label>
                      <input name="branch" required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="Computer Science, IT, etc." />
                  </div>

                  <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Role Applying For</label>
                      <select name="roleSelection" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold text-blue-700">
                        <option value="" disabled>Select a Role</option>
                        <option value="UI/UX Designer">UI/UX Designer</option>
                        <option value="React Developer">React Developer</option>
                        <option value="Backend Developer">Backend Developer</option>
                      </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Tech Stack (Select all that apply)</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {techOptions.map(tech => (
                        <label key={tech} onClick={() => toggleTech(tech)} className={`flex items-center space-x-2 cursor-pointer p-3 border rounded-lg transition ${selectedTech.includes(tech) ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}>
                          <input type="checkbox" checked={selectedTech.includes(tech)} readOnly className="w-5 h-5 text-blue-600 rounded" />
                          <span className="text-sm font-medium text-gray-700">{tech}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Upload CV / Resume (PDF only)</label>
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 transition cursor-pointer relative bg-gray-50/50">
                      <input type="file" accept=".pdf" required onChange={e => setResumeFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" stroke="currentColor" fill="none" viewBox="0 0 48 48"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                      <p className="text-xs text-gray-500 mb-2">PDF up to 5MB</p>
                      <p className="text-sm">
                        {resumeFile ? <span className="font-bold text-green-600 italic">✓ {resumeFile.name}</span> : <span className="text-blue-600 font-bold underline">Click to upload resume</span>}
                      </p>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={submitting} 
                    className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-blue-700 transition transform hover:scale-[1.01] shadow-xl disabled:opacity-50"
                  >
                    {submitting ? 'Processing Application...' : 'Submit Application'}
                  </button>
                </form>
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* Role Detail Modal */}
      {modal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 relative overflow-hidden"
          >
            <button onClick={() => setModal(null)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-800 transition">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <div className="flex items-center mb-6">
                <div className={`bg-${roleDetails[modal].color}-100 p-3 rounded-xl mr-4`}>
                    {roleDetails[modal].icon}
                </div>
                <h3 className="text-2xl font-bold text-gray-900">{roleDetails[modal].key}</h3>
            </div>
            <p className="text-gray-600 mb-6 leading-relaxed italic border-l-4 border-gray-100 pl-4">
                {roleDetails[modal].fullDescription}
            </p>
            <h4 className="font-bold text-gray-900 mb-3 uppercase text-xs tracking-wider">Key Responsibilities:</h4>
            <ul className="space-y-3 text-gray-600 text-sm mb-10">
              {roleDetails[modal].points.map(p => (
                <li key={p} className="flex items-start gap-2">
                    <span className={`text-${roleDetails[modal].color}-600 font-bold mt-0.5 whitespace-nowrap`}>◆</span>
                    {p}
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
              <button 
                onClick={() => setModal(null)} 
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-bold hover:bg-gray-200 transition"
                >
                    Close
                </button>
              <button 
                onClick={() => showForm(roleDetails[modal].key)} 
                className={`bg-${roleDetails[modal].color}-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-${roleDetails[modal].color}-700 transition shadow-lg`}
               >
                 Apply for Role
               </button>
            </div>
          </motion.div>
        </div>
      )}

      <footer className="bg-gray-900 text-white py-12 text-center mt-20">
        <div className="max-w-7xl mx-auto px-4">
            <div className="flex justify-center items-center mb-6">
                <img src="/assets/logo.png" alt="Mealiez" className="h-10 w-10 mr-3 grayscale brightness-200" />
                <span className="text-2xl font-bold tracking-tight">Mealiez</span>
            </div>
            <p className="text-gray-500 text-sm">© 2024 Mealiez Internships. Crafting the future of Mess Management.</p>
        </div>
      </footer>
    </div>
  );
};

export default Internship;
