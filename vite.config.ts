import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        register: resolve(__dirname, 'register.html'),
        student_dashboard: resolve(__dirname, 'student-dashboard.html'),
        admin_dashboard: resolve(__dirname, 'admin-dashboard.html'),
        parent_dashboard: resolve(__dirname, 'parent-dashboard.html'),
        hrdashboard: resolve(__dirname, 'hrdashboard.html'),
        campusambassador: resolve(__dirname, 'campusambassador.html'),
        internship: resolve(__dirname, 'internship.html'),
        report: resolve(__dirname, 'report.html'),
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});