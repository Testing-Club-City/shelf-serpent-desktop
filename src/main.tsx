import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Ultra-fast rendering - remove StrictMode for production speed
const rootElement = document.getElementById('root') as HTMLElement;
const root = ReactDOM.createRoot(rootElement);

// Render without StrictMode to prevent double renders and improve performance
root.render(<App />);

console.log('⚡ Library Management System rendering...');

// App layout sizing is handled in index.css using dvh units for accurate fullscreen sizing.
console.log('✅ Fast rendering complete!');
