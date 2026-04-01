import React from 'react';
import { createRoot } from 'react-dom/client';
import HRDashboard from '../pages/Dashboard/HRDashboard';
import '../index.css';

const root = document.getElementById('root');
if (root) createRoot(root).render(<React.StrictMode><HRDashboard /></React.StrictMode>);
