import React from 'react';
import { createRoot } from 'react-dom/client';
import StudentDashboard from '../pages/Dashboard/StudentDashboard';
import '../index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <StudentDashboard />
    </React.StrictMode>
  );
}
