import React from 'react';
import { PRESET_TEMPLATES, PresetTemplate } from '../types';
import { BookOpen, ArrowRight, Play, Users, ShieldCheck, Laptop, Zap, Building2 } from 'lucide-react';

interface TemplateLibraryProps {
  onSelectTemplate: (template: PresetTemplate) => void;
}

export const TemplateLibrary: React.FC<TemplateLibraryProps> = ({ onSelectTemplate }) => {
  const getCategoryIcon = (category: string) => {
    if (category.includes('Onboarding')) return <Building2 className="w-5 h-5 text-blue-400" />;
    if (category.includes('Segurança')) return <ShieldCheck className="w-5 h-5 text-emerald-400" />;
    if (category.includes('Diálogos')) return <Users className="w-5 h-5 text-purple-400" />;
    if (category.includes('Sistemas')) return <Laptop className="w-5 h-5 text-indigo-400" />;
    return <Zap className="w-5 h-5 text-amber-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="bg-[#0F1115] text-white p-6 rounded-2xl shadow-xl border border-white/5">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-900/40">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Modelos Prontos para Treinamentos em Português (PT-BR)</h2>
            <p className="text-xs text-slate-400">
              Selecione um modelo testado e otimizado para narrações corporativas com o tom adequado.
            </p>
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PRESET_TEMPLATES.map((template) => (
          <div
            key={template.id}
            className="bg-[#14161B] border border-white/5 rounded-2xl p-5 shadow-xl hover:border-indigo-500/50 hover:bg-[#181a20] transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  {getCategoryIcon(template.category)}
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{template.category}</span>
                </div>
                {template.isMultiSpeaker && (
                  <span className="bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    2 Vozes (Diálogo)
                  </span>
                )}
              </div>

              <h3 className="font-bold text-white text-base mb-1.5 group-hover:text-indigo-400 transition-colors">
                {template.title}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">{template.description}</p>

              {/* Preview Box */}
              <div className="bg-[#0D0E12] border border-white/5 rounded-xl p-3 text-xs text-slate-300 line-clamp-4 font-sans leading-relaxed mb-4 italic">
                "{template.script}"
              </div>
            </div>

            <div className="pt-3 border-t border-white/5 flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-400">
                Voz Recomendada: <strong className="text-indigo-400">{template.suggestedVoice}</strong>
              </span>

              <button
                onClick={() => onSelectTemplate(template)}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 group-hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-indigo-900/30 transition-all"
              >
                <span>Usar Modelo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
