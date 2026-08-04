import React from 'react';
import { Sparkles, Mic, Layers, BookOpen, History, Volume2 } from 'lucide-react';

interface HeaderProps {
  activeTab: 'studio' | 'course' | 'templates' | 'history';
  setActiveTab: (tab: 'studio' | 'course' | 'templates' | 'history') => void;
  historyCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  historyCount,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0F1115] border-b border-white/5 text-white shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-900/40">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">VozPro</span>
                <span className="text-indigo-400 font-bold text-lg">Narração</span>
                <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full">
                  PT-BR Studio
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Narração e Locução de Treinamentos Corporativos com IA
              </p>
            </div>
          </div>

          {/* Model Status Indicator */}
          <div className="hidden lg:flex items-center space-x-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-400 font-medium">Motor TTS:</span>
            <span className="text-emerald-400 font-mono font-semibold">Google Cloud Neural2 (4M grátis/mês)</span>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={() => setActiveTab('studio')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'studio'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span className="hidden sm:inline">Estúdio de Narração</span>
              <span className="sm:hidden">Estúdio</span>
            </button>

            <button
              onClick={() => setActiveTab('course')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'course'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span className="hidden sm:inline">Curso por Slides</span>
              <span className="sm:hidden">Slides</span>
            </button>

            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'templates'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Modelos de Roteiro</span>
              <span className="sm:hidden">Modelos</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`relative flex items-center space-x-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'history'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Histórico</span>
              {historyCount > 0 && (
                <span className="ml-1 bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {historyCount}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
