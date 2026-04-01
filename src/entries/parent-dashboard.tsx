import React from 'react';
import { createRoot } from 'react-dom/client';
import ParentDashboard from '../pages/Dashboard/ParentDashboard';
import '../index.css';

const root = document.getElementById('root');
if (root) createRoot(root).render(<React.StrictMode><ParentDashboard /></React.StrictMode>);
