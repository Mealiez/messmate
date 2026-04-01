import React from 'react';
import { createRoot } from 'react-dom/client';
import CampusAmbassador from '../pages/CampusAmbassador/CampusAmbassador';
import '../index.css';

const root = document.getElementById('root');
if (root) createRoot(root).render(<React.StrictMode><CampusAmbassador /></React.StrictMode>);
