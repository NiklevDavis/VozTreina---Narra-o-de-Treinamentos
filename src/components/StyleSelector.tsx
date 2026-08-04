import React from 'react';
import { NARRATION_STYLES, NarrationStyle } from '../types';
import { Sliders, GraduationCap, ShieldCheck, Zap, Heart, Building2 } from 'lucide-react';

interface StyleSelectorProps {
  selectedStyle: NarrationStyle['id'];
  onSelectStyle: (styleId: NarrationStyle['id']) => void;
}

export const StyleSelector: React.FC<StyleSelectorProps> = ({
  selectedStyle,
  onSelectStyle,
}) => {
  const getIcon = (id: string) => {
    switch (id) {
      case 'didatico':
        return <GraduationCap className="w-4 h-4 text-indigo-400" />;
      case 'institucional':
        return <Building2 className="w-4 h-4 text-blue-400" />;
      case 'tecnico':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case 'motivacional':
        return <Zap className="w-4 h-4 text-amber-400" />;
      case 'calmo':
        return <Heart className="w-4 h-4 text-rose-400" />;
      default:
        return <Sliders className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-200 flex items-center gap-2 uppercase tracking-wider">
          <Sliders className="w-4 h-4 text-indigo-400" />
          Tom & Estilo da Narração PT-BR
        </label>
        <span className="text-xs text-slate-500">Adaptação Automática de Ritmo</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {NARRATION_STYLES.map((style) => {
          const isSelected = selectedStyle === style.id;
          return (
            <button
              key={style.id}
              type="button"
              onClick={() => onSelectStyle(style.id)}
              className={`text-left p-3.5 rounded-xl border transition-all ${
                isSelected
                  ? 'bg-indigo-500/10 border-indigo-500/50 ring-1 ring-indigo-500/30 shadow-lg shadow-indigo-950/40'
                  : 'bg-[#0D0E12] border-white/5 hover:border-white/10 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center space-x-2 mb-2">
                {getIcon(style.id)}
                <span className="font-bold text-white text-xs sm:text-sm">{style.label}</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed mb-3">{style.description}</p>
              <span className="inline-block text-[10px] font-semibold bg-white/10 text-slate-300 px-2 py-0.5 rounded-md">
                {style.badge}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
