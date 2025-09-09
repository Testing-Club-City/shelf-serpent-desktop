import React from 'react';

function AppDebug() {
  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'Arial, sans-serif',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f5f5f5'
    }}>
      <h1 style={{ color: '#333', marginBottom: '20px' }}>🚀 Library Management System - Debug Mode</h1>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '20px', 
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        maxWidth: '600px',
        textAlign: 'center'
      }}>
        <h2 style={{ color: '#4CAF50' }}>✅ Application is Working!</h2>
        <p>The Tauri app is successfully loading React components.</p>
        <p>If you see this message, the basic setup is working correctly.</p>
        
        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#e8f5e8', borderRadius: '4px' }}>
          <p><strong>Next Steps:</strong></p>
          <ul style={{ textAlign: 'left', marginTop: '10px' }}>
            <li>Check browser console for any JavaScript errors</li>
            <li>Verify database connection</li>
            <li>Test authentication system</li>
            <li>Confirm sync functionality</li>
          </ul>
        </div>
        
        <button 
          onClick={() => window.location.reload()}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          🔄 Reload Application
        </button>
      </div>
    </div>
  );
}

export default AppDebug;
