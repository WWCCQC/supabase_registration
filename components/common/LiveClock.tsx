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
      <div
        className="topbar-chip"
        style={{ fontSize: 14, minWidth: 210, justifyContent: "center" }}
      >
        กำลังโหลด...
      </div>
    );
  }

  return (
    <div
      className="topbar-chip"
      style={{ fontSize: 14, minWidth: 210, justifyContent: "center" }}
    >
      <span style={{ opacity: 0.8 }}>⏱️</span>
      <strong>
        {currentTime.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })}{" "}
        {currentTime.toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}
      </strong>
    </div>
  );
}
