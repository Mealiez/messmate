import React from 'react';
import { createRoot } from 'react-dom/client';
import Home from '../pages/Home/Home';
import '../index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <Home />
    </React.StrictMode>
  );
}
