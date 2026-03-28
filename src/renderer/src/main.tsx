import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Error Relay for Debugging (Render -> Main)
window.onerror = (message, source, lineno, colno, error) => {
  console.error('Renderer Error:', { message, source, lineno, colno, error });
  // If window.api exists, we can use it to relay to Main process console
  if (window.api) {
    // Actually standard console.error in Vite Electron is often enough
  }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
