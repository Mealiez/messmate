import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  // Tell Vite the source code is in the 'public' folder
  root: 'public',
  // Tell Vite to output the build to the 'dist' folder in the project root
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // List all your pages here so Vite knows about them
        main: resolve(__dirname, 'public/index.html'),
        login: resolve(__dirname, 'public/login.html'),
        register: resolve(__dirname, 'public/register.html'),
        student_dashboard: resolve(__dirname, 'public/student-dashboard.html'),
        parent_dashboard: resolve(__dirname, 'public/parent-dashboard.html'),
        admin_dashboard: resolve(__dirname, 'public/admin-dashboard.html'),
        hr_dashboard: resolve(__dirname, 'public/hrdashboard.html'),
        campus_ambassador: resolve(__dirname, 'public/campusambassador.html'),
        internship: resolve(__dirname, 'public/internship.html'),
        report: resolve(__dirname, 'public/report.html'),
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});