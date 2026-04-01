import React from 'react';
import { createRoot } from 'react-dom/client';
import Reports from '../pages/Reports/Reports';
import '../index.css';

const root = document.getElementById('root');
if (root) createRoot(root).render(<React.StrictMode><Reports /></React.StrictMode>);
