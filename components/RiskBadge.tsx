
import React from 'react';
import { RiskLevel } from '../types';

interface RiskBadgeProps {
  level: RiskLevel;
}

const RiskBadge: React.FC<RiskBadgeProps> = ({ level }) => {
  const getStyles = () => {
    switch (level) {
      case RiskLevel.LOW:
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
      case RiskLevel.MEDIUM:
        return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
      case RiskLevel.HIGH:
        return 'bg-rose-500/20 text-rose-400 border-rose-500/50';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${getStyles()}`}>
      {level} RISK
    </span>
  );
};

export default RiskBadge;
