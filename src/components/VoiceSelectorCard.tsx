import React from 'react';
import { GEMINI_VOICES, KOKORO_VOICES, VoiceOption, TTSEngine } from '../types';
import { UserCheck, Sparkles, Check } from 'lucide-react';

interface VoiceSelectorCardProps {
  selectedVoice: string;
  onSelectVoice: (voiceId: string) => void;
  label?: string;
  selectedEngine?: TTSEngine;
}

export const VoiceSelectorCard: React.FC<VoiceSelectorCardProps> = ({
  selectedVoice,
  onSelectVoice,
  label = "Selecione a Voz do Locutor",
  selectedEngine = "gemini-flash",
}) => {
  const voicesList = selectedEngine === "kokoro-82m" ? KOKORO_VOICES : GEMINI_VOICES;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-slate-200 flex items-center gap-2 uppercase tracking-wider text-xs">
          <UserCheck className="w-4 h-4 text-indigo-400" />
          {label}
        </label>
        <span className="text-xs text-slate-500">
          {voicesList.length} Vozes {selectedEngine === "kokoro-82m" ? "Kokoro-82M" : "Gemini"} Disponíveis
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {voicesList.map((voice) => {
          const isSelected = selectedVoice === voice.id;
          return (
            <button
              key={voice.id}
              type="button"
              onClick={() => onSelectVoice(voice.id)}
              className={`relative text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                isSelected
                  ? 'bg-indigo-500/10 border-indigo-500/50 ring-1 ring-indigo-500/30 shadow-lg shadow-indigo-950/40'
                  : 'bg-[#0D0E12] border-white/5 hover:border-white/10 hover:bg-white/5 text-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-white text-sm">{voice.name}</span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      voice.gender === 'Feminino'
                        ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    }`}
                  >
                    {voice.gender}
                  </span>
                </div>

                <p className="text-xs font-semibold text-indigo-400 mb-1">{voice.title}</p>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-3">
                  {voice.description}
                </p>
              </div>

              <div className="pt-2.5 border-t border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-medium truncate max-w-[120px]" title={voice.idealFor}>
                  {voice.idealFor}
                </span>
                {isSelected && (
                  <div className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
