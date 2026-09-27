"use client";

import React from 'react';

function formatEnDateTime(isoString: string): string {
  const d = new Date(isoString);
  const date = d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  });
  const time = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Bangkok',
  });
  return `${date} ${time}`;
}

interface DataUpdatedChipProps {
  style?: React.CSSProperties;
}

const DataUpdatedChip: React.FC<DataUpdatedChipProps> = ({ style }) => {
  const [lastUpdated, setLastUpdated] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch('/api/meta/last-updated')
      .then((r) => r.json())
      .then((d) => { if (d.lastUpdated) setLastUpdated(d.lastUpdated); })
      .catch(() => {});
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        color: 'rgba(255,255,255,0.85)',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <span style={{ opacity: 0.8 }}>🕐</span>
      <span>
        Data updated as{' '}
        <strong>{lastUpdated ? formatEnDateTime(lastUpdated) : '—'}</strong>
      </span>
    </div>
  );
};

export default DataUpdatedChip;
