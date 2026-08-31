import React from 'react';

const MatrixBackground = ({ enabled = true, color = '#00ff66' }) => {
  if (!enabled) return null;

  return (
    <div 
      className="cyber-ambient-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.08,
        backgroundImage: `
          linear-gradient(to right, ${color} 1px, transparent 1px),
          linear-gradient(to bottom, ${color} 1px, transparent 1px)
        `,
        backgroundSize: '32px 32px',
      }}
    />
  );
};

export default MatrixBackground;
