import React from 'react';
import { AudioHistoryItem } from '../types';
import { History, Download, Trash2, Volume2, Clock, Calendar } from 'lucide-react';
import { formatTime } from '../lib/audioUtils';

interface HistoryPanelProps {
  history: AudioHistoryItem[];
  onClearHistory: () => void;
  onRemoveHistoryItem: (id: string) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  onClearHistory,
  onRemoveHistoryItem,
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0F1115] border border-white/5 rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Histórico de Narrações Geradas</h2>
            <p className="text-xs text-slate-400">
              Acesse e baixe novamente seus áudios produzidos nesta sessão
            </p>
          </div>
        </div>

        {history.length > 0 && (
          <button
            onClick={onClearHistory}
            className="text-xs text-rose-400 hover:text-rose-300 font-semibold px-3 py-1.5 rounded-lg border border-rose-500/30 hover:bg-rose-500/10 transition-colors flex items-center space-x-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar Histórico</span>
          </button>
        )}
      </div>

      {/* History Items List */}
      {history.length === 0 ? (
        <div className="bg-[#14161B] border border-dashed border-white/10 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-white/5 text-slate-400 flex items-center justify-center mx-auto">
            <Volume2 className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-white text-base">Nenhum áudio no histórico ainda</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Gere uma narração no estúdio principal ou no criador por slides para armazenar seus arquivos aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => (
            <div
              key={item.id}
              className="bg-[#14161B] border border-white/5 rounded-2xl p-4 shadow-xl hover:border-white/10 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1 max-w-xl">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white text-sm">{item.title}</span>
                  <span className="bg-white/5 border border-white/10 text-slate-300 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                    Voz: {item.voice}
                  </span>
                  {item.pacing && (
                    <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                      Cadência: {item.pacing}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">"{item.text}"</p>
                <div className="flex items-center space-x-3 text-[11px] text-slate-500 pt-1">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(item.duration)}</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>{item.createdAt}</span>
                  </span>
                </div>
              </div>

              {/* Player and Actions */}
              <div className="flex items-center space-x-3 shrink-0">
                <audio src={item.audioUrl} controls className="h-8 w-48 sm:w-60 accent-indigo-500" />
                <a
                  href={item.audioUrl}
                  download={`narracao-${item.title.toLowerCase().replace(/\s+/g, '-')}.wav`}
                  className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-md shadow-indigo-900/30"
                  title="Baixar WAV"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => onRemoveHistoryItem(item.id)}
                  className="p-2 text-slate-500 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
