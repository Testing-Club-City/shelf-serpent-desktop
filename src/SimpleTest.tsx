import React from 'react';

function SimpleTest() {
  console.log('SimpleTest component is rendering');
  
  const styles = {
    container: {
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f0f0f0',
      minHeight: '100vh'
    },
    heading: {
      color: '#333',
      fontSize: '24px'
    },
    text: {
      color: '#666',
      fontSize: '16px'
    }
  };
  
  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Hello World!</h1>
      <p style={styles.text}>This is a simple test component.</p>
      <p style={styles.text}>Current time: {new Date().toLocaleString()}</p>
    </div>
  );
}

export default SimpleTest;
