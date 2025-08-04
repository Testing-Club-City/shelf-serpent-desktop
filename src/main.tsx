import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

console.log('main.tsx is executing');
console.log('Document ready state:', document.readyState);

const rootElement = document.getElementById("root");
console.log('Root element found:', !!rootElement);

if (rootElement) {
  const root = createRoot(rootElement);
  console.log('Creating React root with original App');
  root.render(<App />);
  console.log('React app rendered');
} else {
  console.error('Root element not found!');
}
