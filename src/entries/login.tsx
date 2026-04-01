import React from 'react';
import { createRoot } from 'react-dom/client';
import Login from '../pages/Auth/Login';
import '../index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <Login />
    </React.StrictMode>
  );
}
