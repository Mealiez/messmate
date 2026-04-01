import React from 'react';
import { createRoot } from 'react-dom/client';
import AdminDashboard from '../pages/Dashboard/AdminDashboard';
import '../index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <AdminDashboard />
    </React.StrictMode>
  );
}
