
import React from 'react';
import { RiskLevel } from '../types';

interface SafetyWarningProps {
  message: string;
  level: RiskLevel;
}

const SafetyWarning: React.FC<SafetyWarningProps> = ({ message, level }) => {
  const getIcon = () => {
    if (level === RiskLevel.HIGH) return 'fa-triangle-exclamation';
    if (level === RiskLevel.MEDIUM) return 'fa-circle-info';
    return 'fa-check-circle';
  };

  const getColors = () => {
    if (level === RiskLevel.HIGH) return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
    if (level === RiskLevel.MEDIUM) return 'bg-amber-500/10 text-amber-200 border-amber-500/30';
    return 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30';
  };

  return (
    <div className={`mt-4 p-4 rounded-xl border flex items-start gap-3 ${getColors()}`}>
      <i className={`fas ${getIcon()} mt-1`}></i>
      <div>
        <h4 className="font-bold text-sm uppercase tracking-wider mb-1">Safety Note</h4>
        <p className="text-sm opacity-90">{message}</p>
      </div>
    </div>
  );
};

export default SafetyWarning;
