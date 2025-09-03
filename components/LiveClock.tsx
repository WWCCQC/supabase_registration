"use client";
import React from "react";

export default function LiveClock() {
  const [currentTime, setCurrentTime] = React.useState<Date | null>(null);

  React.useEffect(() => {
    // Set initial time
    setCurrentTime(new Date());
    
    // Update time every second
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Return placeholder during SSR or until client hydration
  if (!currentTime) {
    return (
      <div style={{ 
        fontSize: 16, 
        color: 'white',
        fontWeight: 500,
        padding: '8px 16px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        minWidth: '200px',
        textAlign: 'center'
      }}>
        กำลังโหลด...
      </div>
    );
  }

  return (
    <div style={{ 
      fontSize: 16, 
      color: 'white',
      fontWeight: 500,
      padding: '8px 16px',
      background: 'rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      minWidth: '200px',
      textAlign: 'center'
    }}>
      {currentTime.toLocaleDateString('th-TH', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      })} {currentTime.toLocaleTimeString('th-TH', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      })}
    </div>
  );
}
