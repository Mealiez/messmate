import React from 'react';
import { createRoot } from 'react-dom/client';
import Register from '../pages/Auth/Register';
import '../index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <Register />
    </React.StrictMode>
  );
}
