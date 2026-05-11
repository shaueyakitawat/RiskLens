import React from 'react';

interface RiskScoreGaugeProps {
  score: number; // 0 to 100
  label: string;
  size?: number;
}

export const RiskScoreGauge: React.FC<RiskScoreGaugeProps> = ({ score, label, size = 120 }) => {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  // Determine color theme based on score severity
  let strokeColor = '#22d3ee'; // Teal for low
  let glowColor = 'rgba(34, 211, 238, 0.4)';
  if (score >= 40 && score < 70) {
    strokeColor = '#a855f7'; // Purple for medium
    glowColor = 'rgba(168, 85, 247, 0.4)';
  } else if (score >= 70) {
    strokeColor = '#fb7185'; // Rose/Red for high
    glowColor = 'rgba(251, 113, 133, 0.4)';
  }

  return (
    <div className="flex flex-col items-center justify-center select-none" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Shadow glow container */}
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={strokeColor}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.8s ease-in-out',
              filter: `drop-shadow(0 0 6px ${glowColor})`,
            }}
          />
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tracking-tight text-white font-sans">{score}</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">{label}</span>
        </div>
      </div>
    </div>
  );
};
