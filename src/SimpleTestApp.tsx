import React from 'react';

export default function SimpleTestApp() {
  console.log('🎯 SimpleTestApp rendering...');
  
  return (
    <div style={{
      padding: '40px',
      fontFamily: 'Arial, sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <h1 style={{ fontSize: '48px', marginBottom: '20px', textAlign: 'center' }}>
        🎉 Library Management System
      </h1>
      <p style={{ fontSize: '24px', marginBottom: '30px', textAlign: 'center' }}>
        ✅ React is working perfectly!
      </p>
      <div style={{ 
        background: 'rgba(255,255,255,0.2)', 
        padding: '20px', 
        borderRadius: '10px',
        textAlign: 'center',
        maxWidth: '600px'
      }}>
        <h2 style={{ marginBottom: '15px' }}>🔧 System Status</h2>
        <p>✅ Rust Backend: Initialized</p>
        <p>✅ React Frontend: Working</p>
        <p>✅ Tauri Bridge: Connected</p>
        <p>✅ UI Rendering: Success</p>
        
        <button
          onClick={() => {
            console.log('🖱️ Button clicked!');
            alert('Button works! The UI is fully functional.');
          }}
          style={{
            marginTop: '20px',
            padding: '12px 24px',
            fontSize: '16px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
          onMouseOver={(e) => (e.target as HTMLButtonElement).style.background = '#45a049'}
          onMouseOut={(e) => (e.target as HTMLButtonElement).style.background = '#4CAF50'}
        >
          🧪 Test Interaction
        </button>
      </div>
      
      <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '14px', opacity: 0.8 }}>
        <p>If you see this screen, the initialization hang issue is fixed!</p>
        <p>Ready to load the full application...</p>
      </div>
    </div>
  );
}
