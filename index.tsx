import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App.js';
import './index.css';
import { AppProvider } from './contexts/AppContext.js';

const AppContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [scale, setScale] = useState(1);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);

  // Base resolution for the desktop layout, updated to 16:9
  const BASE_WIDTH = 1920;
  const BASE_HEIGHT = 1080; 

  useEffect(() => {
    const handleResize = () => {
      // Set the --vh custom property to fix mobile viewport height issues.
      document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);

      const desktop = window.innerWidth > 1024;
      setIsDesktop(desktop);

      if (desktop) {
        // On desktop, scale the app to fit the window while maintaining aspect ratio (letterboxing).
        const widthScale = window.innerWidth / BASE_WIDTH;
        const heightScale = window.innerHeight / BASE_HEIGHT;
        const uniformScale = Math.min(widthScale, heightScale); // Use the smaller scale factor to fit
        setScale(uniformScale);
      } else {
        // Reset scale for mobile view
        setScale(1);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial calculation

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const desktopStyle: React.CSSProperties = {
    width: `${BASE_WIDTH}px`,
    height: `${BASE_HEIGHT}px`,
    transform: `scale(${scale})`,
    transformOrigin: 'center center', // Scale from the center
  };

  // On mobile, use a standard responsive flow without scaling.
  const mobileStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    padding: '0.5rem', // Add some padding for smaller screens
  };

  return (
    <div style={isDesktop ? desktopStyle : mobileStyle}>
      {children}
    </div>
  );
};


const rootElement = document.getElementById('root') as HTMLElement & { _reactRoot?: ReactDOM.Root };
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

if (!rootElement._reactRoot) {
  rootElement._reactRoot = ReactDOM.createRoot(rootElement);
}

rootElement._reactRoot.render(
  <React.StrictMode>
    <AppProvider>
      <AppContainer>
        <App />
      </AppContainer>
    </AppProvider>
  </React.StrictMode>
);