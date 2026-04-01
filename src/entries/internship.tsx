import React from 'react';
import { createRoot } from 'react-dom/client';
import Internship from '../pages/Internship/Internship';
import '../index.css';

const root = document.getElementById('root');
if (root) createRoot(root).render(<React.StrictMode><Internship /></React.StrictMode>);
