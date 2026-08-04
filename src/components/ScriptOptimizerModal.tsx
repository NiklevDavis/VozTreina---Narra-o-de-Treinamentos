import React, { useState } from 'react';
import { Sparkles, X, Wand2, ArrowRight, Check } from 'lucide-react';

interface ScriptOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyScript: (optimizedScript: string) => void;
}

export const ScriptOptimizerModal: React.FC<ScriptOptimizerModalProps> = ({
  isOpen,
  onClose,
  onApplyScript,
}) => {
  const [rawText, setRawText] = useState('');
  const [targetTone, setTargetTone] = useState<'didatico' | 'motivacional' | 'tecnico' | 'institucional'>('didatico');
  const [mode, setMode] = useState<'narracao' | 'dialogo'>('narracao');
  const [isLoading, setIsLoading] = useState(false);
  const [optimizedResult, setOptimizedResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOptimize = async () => {
    if (!rawText.trim()) return;
    setIsLoading(true);
    setOptimizedResult(null);

    try {
      const res = await fetch('/api/script/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText,
          targetTone,
          mode,
        }),
      });
      const data = await res.json();
      if (data.optimizedScript) {
        setOptimizedResult(data.optimizedScript);
      }
    } catch (err) {
      console.error("Error optimizing script:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (optimizedResult) {
      onApplyScript(optimizedResult);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#14161B] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0F1115] border-b border-white/5 text-white">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base">Otimizador de Roteiro PT-BR</h3>
              <p className="text-xs text-slate-400">
                Transforme slides, textos brutos ou tópicos em narração fluida para locução
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Mode toggle */}
          <div className="flex items-center space-x-2 bg-white/5 border border-white/5 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode('narracao')}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                mode === 'narracao'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Narração Individual (1 Locutor)
            </button>
            <button
              type="button"
              onClick={() => setMode('dialogo')}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                mode === 'dialogo'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Diálogo Educativo (Instrutor + Aluno)
            </button>
          </div>

          {/* Target Tone Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Tom de Locução Alvo:</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { id: 'didatico', label: 'Didático & Claro' },
                { id: 'institucional', label: 'Institucional' },
                { id: 'tecnico', label: 'Técnico & Segurança' },
                { id: 'motivacional', label: 'Motivacional' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTargetTone(t.id as any)}
                  className={`p-2.5 rounded-lg border text-left font-medium transition-all ${
                    targetTone === t.id
                      ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Raw Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              Cole o texto bruto, conteúdo do slide ou tópicos:
            </label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Cole aqui o conteúdo cru da sua apresentação, tópicos do treinamento ou notas do slide..."
              className="w-full h-32 p-3 text-sm bg-[#0D0E12] border border-white/10 rounded-xl focus:border-indigo-500 outline-none resize-none font-sans text-slate-200 placeholder-slate-600"
            />
          </div>

          {/* Generate Action */}
          <button
            onClick={handleOptimize}
            disabled={isLoading || !rawText.trim()}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-indigo-900/30 flex items-center justify-center space-x-2 transition-all"
          >
            {isLoading ? (
              <>
                <Wand2 className="w-4 h-4 animate-spin" />
                <span>Otimizando e Reescrevendo com IA...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>Gerar Roteiro Otimizado para Áudio</span>
              </>
            )}
          </button>

          {/* Result preview */}
          {optimizedResult && (
            <div className="space-y-2 pt-2 border-t border-white/5 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <Check className="w-4 h-4 text-emerald-400" />
                  Roteiro Sugerido Pronto
                </span>
              </div>
              <div className="bg-[#0D0E12] border border-white/10 rounded-xl p-3.5 max-h-40 overflow-y-auto text-sm text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                {optimizedResult}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#0F1115] border-t border-white/5 flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          {optimizedResult && (
            <button
              onClick={handleApply}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-indigo-900/30 transition-all"
            >
              <span>Aplicar no Estúdio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
