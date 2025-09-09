// Completely static test to check if webview is working
console.log('🚀 STATIC TEST - main.tsx executing');

// Set up basic static page
document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 DOM loaded');
  
  document.body.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
      color: white;
      font-family: Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    ">
      <h1 style="font-size: 3em; margin-bottom: 20px; text-align: center;">
        🎯 Static UI Test
      </h1>
      
      <div style="
        background: rgba(255,255,255,0.1);
        padding: 30px;
        border-radius: 15px;
        text-align: center;
        max-width: 600px;
        backdrop-filter: blur(10px);
      ">
        <h2 style="margin-bottom: 20px;">✅ Webview Status</h2>
        <p style="font-size: 1.2em; margin: 10px 0;">✅ HTML Loaded</p>
        <p style="font-size: 1.2em; margin: 10px 0;">✅ CSS Working</p>
        <p style="font-size: 1.2em; margin: 10px 0;" id="js-status">🔄 Testing JavaScript...</p>
        
        <button id="test-btn" style="
          margin-top: 20px;
          padding: 15px 30px;
          font-size: 1.1em;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.3s;
        ">
          🧪 Test JavaScript
        </button>
        
        <div id="react-status" style="margin-top: 20px; font-size: 1.1em;"></div>
      </div>
      
      <div style="margin-top: 30px; text-align: center; opacity: 0.8;">
        <p>🔧 Diagnostic Mode - Testing basic functionality</p>
        <p>User Agent: ${navigator.userAgent}</p>
        <p>Location: ${window.location.href}</p>
      </div>
    </div>
  `;
  
  // Test JavaScript
  const jsStatus = document.getElementById('js-status');
  const testBtn = document.getElementById('test-btn');
  const reactStatus = document.getElementById('react-status');
  
  if (jsStatus) {
    jsStatus.innerHTML = '✅ JavaScript Working';
    jsStatus.style.color = '#4CAF50';
  }
  
  if (testBtn) {
    testBtn.addEventListener('click', () => {
      console.log('🖱️ Button clicked successfully');
      if (reactStatus) {
        reactStatus.innerHTML = '✅ Event Handlers Working<br>🔄 Now testing React...';
        
        // Test React after click
        testReact();
      }
    });
  }
});

function testReact() {
  console.log('🧪 Testing React imports...');
  const reactStatus = document.getElementById('react-status');
  
  // Use dynamic imports to test React
  Promise.all([
    import('react'),
    import('react-dom/client')
  ]).then(([React, { createRoot }]) => {
    console.log('✅ React modules imported successfully');
    
    if (reactStatus) {
      reactStatus.innerHTML = '✅ React Modules Loaded<br>🔄 Testing React render...';
    }
    
    // Create a simple React component
    const TestComponent = React.createElement('div', {
      style: {
        background: 'rgba(76, 175, 80, 0.2)',
        padding: '15px',
        borderRadius: '8px',
        margin: '10px 0',
        border: '2px solid #4CAF50'
      }
    }, [
      React.createElement('h3', { key: 'title' }, '🎉 React is Working!'),
      React.createElement('p', { key: 'desc' }, 'React components can render successfully'),
      React.createElement('button', {
        key: 'btn',
        onClick: () => alert('React events working!'),
        style: {
          padding: '8px 16px',
          background: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }
      }, 'Test React Event')
    ]);
    
    // Create root and render
    const reactContainer = document.createElement('div');
    document.body.appendChild(reactContainer);
    
    const root = createRoot(reactContainer);
    root.render(TestComponent);
    
    if (reactStatus) {
      reactStatus.innerHTML = '✅ React Render Complete!<br>✅ All tests passed!';
    }
    
    console.log('🎉 All tests completed successfully!');
    
  }).catch((error) => {
    console.error('❌ React test failed:', error);
    if (reactStatus) {
      reactStatus.innerHTML = `❌ React Test Failed:<br>${error.message}`;
      reactStatus.style.color = '#ff6b6b';
    }
  });
}
