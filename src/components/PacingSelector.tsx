import React from 'react';
import { Gauge, Clock, Zap, Sparkles } from 'lucide-react';
import { NarrationPacing, NARRATION_PACING_OPTIONS } from '../types';

interface PacingSelectorProps {
  selectedPacing: NarrationPacing;
  onSelectPacing: (pacing: NarrationPacing) => void;
}

export const PacingSelector: React.FC<PacingSelectorProps> = ({
  selectedPacing,
  onSelectPacing,
}) => {
  const getIcon = (id: NarrationPacing) => {
    switch (id) {
      case 'pausado':
        return <Clock className="w-4 h-4 text-emerald-400" />;
      case 'normal':
        return <Gauge className="w-4 h-4 text-indigo-400" />;
      case 'rapido':
        return <Zap className="w-4 h-4 text-amber-400" />;
      case 'expressivo':
        return <Sparkles className="w-4 h-4 text-purple-400" />;
      default:
        return <Gauge className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-200 flex items-center gap-2 uppercase tracking-wider">
          <Gauge className="w-4 h-4 text-indigo-400" />
          Velocidade & Cadência da Narração (Sintetizador)
        </label>
        <span className="text-xs text-slate-400 font-mono">
          {NARRATION_PACING_OPTIONS.find((p) => p.id === selectedPacing)?.speedTag || 'Normal'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {NARRATION_PACING_OPTIONS.map((option) => {
          const isSelected = selectedPacing === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelectPacing(option.id)}
              className={`text-left p-3.5 rounded-xl border transition-all relative overflow-hidden ${
                isSelected
                  ? 'bg-indigo-500/10 border-indigo-500/50 ring-1 ring-indigo-500/30 shadow-lg shadow-indigo-950/40'
                  : 'bg-[#0D0E12] border-white/5 hover:border-white/10 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {getIcon(option.id)}
                  <span className="font-bold text-white text-xs sm:text-sm">{option.label}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                  {option.wpmEstimate}
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed mb-3">{option.description}</p>

              <div className="flex items-center justify-between pt-1 border-t border-white/5">
                <span className="text-[10px] font-semibold text-indigo-300">
                  {option.speedTag}
                </span>
                <span className="text-[10px] font-semibold bg-white/10 text-slate-300 px-2 py-0.5 rounded-md">
                  {option.badge}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
