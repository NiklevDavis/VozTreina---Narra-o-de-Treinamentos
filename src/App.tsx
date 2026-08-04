import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { VoiceSelectorCard } from './components/VoiceSelectorCard';
import { StyleSelector } from './components/StyleSelector';
import { PacingSelector } from './components/PacingSelector';
import { AudioPlayer } from './components/AudioPlayer';
import { ScriptOptimizerModal } from './components/ScriptOptimizerModal';
import { SlideCourseManager } from './components/SlideCourseManager';
import { TemplateLibrary } from './components/TemplateLibrary';
import { HistoryPanel } from './components/HistoryPanel';
import {
  AudioHistoryItem,
  GEMINI_VOICES,
  NARRATION_STYLES,
  NarrationStyle,
  NarrationPacing,
  PresetTemplate,
} from './types';
import {
  Mic,
  Sparkles,
  Volume2,
  Wand2,
  Plus,
  Clock,
  FileText,
  HelpCircle,
  Users,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { estimateReadingTimeSeconds, formatTime } from './lib/audioUtils';

export default function App() {
  const [activeTab, setActiveTab] = useState<'studio' | 'course' | 'templates' | 'history'>('studio');

  // Main Studio Form State
  const [isMultiSpeaker, setIsMultiSpeaker] = useState(false);
  const [singleVoice, setSingleVoice] = useState('Kore');
  const [speaker1, setSpeaker1] = useState({ name: 'Instrutor', voice: 'Kore' });
  const [speaker2, setSpeaker2] = useState({ name: 'Aluno', voice: 'Puck' });
  const [selectedStyle, setSelectedStyle] = useState<NarrationStyle['id']>('didatico');
  const [selectedPacing, setSelectedPacing] = useState<NarrationPacing>('normal');
  const [scriptTitle, setScriptTitle] = useState('Módulo 1: Integração e Boas Práticas');
  const [scriptText, setScriptText] = useState(
    'Olá! Seja muito bem-vindo ao nosso treinamento corporativo. Neste módulo, apresentaremos as diretrizes fundamentais da empresa, nosso código de conduta e as melhores práticas para o seu dia a dia profissional.'
  );

  // Audio Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedAudio, setGeneratedAudio] = useState<{
    url: string;
    duration: number;
    title: string;
    voiceUsed: string;
  } | null>(null);

  // Optimizer Modal
  const [isOptimizerModalOpen, setIsOptimizerModalOpen] = useState(false);
  const [isDraggingStudioFile, setIsDraggingStudioFile] = useState(false);

  const handleStudioDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingStudioFile(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) {
        setScriptText(content);
        if (file.name) {
          setScriptTitle(file.name.replace(/\.[^/.]+$/, ''));
        }
      }
    };
    reader.readAsText(file);
  };

  // History State backed by SQLite Database
  const [history, setHistory] = useState<AudioHistoryItem[]>([]);

  // Fetch initial history from SQLite
  useEffect(() => {
    fetch('/api/db/history')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setHistory(data);
      })
      .catch((err) => console.warn('Could not load history from SQLite db:', err));
  }, []);

  const saveToHistory = async (
    title: string,
    text: string,
    audioUrl: string,
    duration: number,
    voice: string,
    style: string,
    isMultiSpeaker = false
  ) => {
    const newItem: AudioHistoryItem = {
      id: Date.now().toString(),
      title,
      text,
      audioUrl,
      duration,
      voice,
      style,
      isMultiSpeaker,
      createdAt: new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setHistory((prev) => [newItem, ...prev]);

    try {
      await fetch('/api/db/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });
    } catch (err) {
      console.warn('Error persisting history item to SQLite:', err);
    }
  };

  const handleClearHistory = async () => {
    setHistory([]);
    try {
      await fetch('/api/db/history', { method: 'DELETE' });
    } catch (err) {
      console.warn('Error clearing history in SQLite:', err);
    }
  };

  const handleRemoveHistoryItem = async (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
    try {
      await fetch(`/api/db/history/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Error deleting history item in SQLite:', err);
    }
  };

  // Quick Directive Insertion helper
  const insertDirective = (tag: string) => {
    setScriptText((prev) => `${prev} ${tag} `);
  };

  // Trigger TTS Generation
  const handleGenerateTTS = async () => {
    if (!scriptText.trim()) return;
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const payload = {
        text: scriptText,
        voice: singleVoice,
        style: selectedStyle,
        pacing: selectedPacing,
        isMultiSpeaker,
        speaker1,
        speaker2,
      };

      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.audioUrl) {
        throw new Error(data.error || 'Erro ao gerar o áudio da narração.');
      }

      setGeneratedAudio({
        url: data.audioUrl,
        duration: data.duration,
        title: scriptTitle || 'Narração de Treinamento',
        voiceUsed: data.voiceUsed || (isMultiSpeaker ? `${speaker1.voice} & ${speaker2.voice}` : singleVoice),
      });

      // Save to History
      saveToHistory(
        scriptTitle || 'Narração de Treinamento',
        scriptText,
        data.audioUrl,
        data.duration,
        isMultiSpeaker ? `${speaker1.name} (${speaker1.voice}) & ${speaker2.name} (${speaker2.voice})` : singleVoice,
        selectedStyle,
        isMultiSpeaker
      );
    } catch (err: any) {
      console.error("Error generating TTS:", err);
      setErrorMessage(err.message || 'Erro ao comunicar com o servidor.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle template selection
  const handleSelectTemplate = (template: PresetTemplate) => {
    setScriptTitle(template.title);
    setScriptText(template.script);
    setSingleVoice(template.suggestedVoice);
    setSelectedStyle(template.suggestedStyle);
    if (template.isMultiSpeaker) {
      setIsMultiSpeaker(true);
    } else {
      setIsMultiSpeaker(false);
    }
    setActiveTab('studio');
  };

  // Calculated word & duration metrics
  const estimatedSeconds = estimateReadingTimeSeconds(scriptText);
  const wordCount = scriptText.trim() ? scriptText.trim().split(/\s+/).length : 0;

  return (
    <div className="min-h-screen bg-[#0A0B0D] font-sans text-slate-200 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Header Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        historyCount={history.length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Tab 1: Main TTS Studio */}
        {activeTab === 'studio' && (
          <div className="space-y-6 animate-fade-in">
            {/* Top Banner & Mode Switcher */}
            <div className="bg-[#0F1115] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold px-2.5 py-0.5 rounded-md uppercase">
                    Estúdio de Locução
                  </span>
                  <span className="text-xs text-slate-400 font-medium">Narração Profissional para E-Learning</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">
                  Criador de Narração em Português do Brasil
                </h1>
              </div>

              {/* Single Voice vs Dialogue Mode Toggle */}
              <div className="flex items-center bg-white/5 p-1.5 rounded-xl border border-white/5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setIsMultiSpeaker(false)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                    !isMultiSpeaker
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Locução Única</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsMultiSpeaker(true)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                    isMultiSpeaker
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-purple-400" />
                  <span>Diálogo (2 Vozes)</span>
                </button>
              </div>
            </div>

            {/* Voice & Speaker Selection */}
            {!isMultiSpeaker ? (
              <VoiceSelectorCard
                selectedVoice={singleVoice}
                onSelectVoice={setSingleVoice}
                label="Selecione a Voz do Narrador"
              />
            ) : (
              <div className="bg-[#14161B] border border-white/5 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center space-x-2 border-b border-white/5 pb-3">
                  <Users className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-bold text-white">
                    Configuração do Diálogo (2 Locutores em Português)
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Speaker 1 */}
                  <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-300">Locutor 1 (ex: Instrutor)</span>
                      <span className="text-[10px] text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 rounded-md font-medium">
                        Primeira Voz
                      </span>
                    </div>
                    <input
                      type="text"
                      value={speaker1.name}
                      onChange={(e) => setSpeaker1({ ...speaker1, name: e.target.value })}
                      placeholder="Nome na marcação (ex: Instrutor)"
                      className="w-full text-xs p-2.5 border border-white/10 rounded-lg bg-[#0D0E12] outline-none font-semibold text-white focus:border-indigo-500"
                    />
                    <select
                      value={speaker1.voice}
                      onChange={(e) => setSpeaker1({ ...speaker1, voice: e.target.value })}
                      className="w-full text-xs p-2.5 border border-white/10 rounded-lg bg-[#0D0E12] outline-none font-medium text-white focus:border-indigo-500"
                    >
                      {GEMINI_VOICES.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} - {v.title} ({v.gender})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Speaker 2 */}
                  <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-300">Locutor 2 (ex: Aluno)</span>
                      <span className="text-[10px] text-purple-300 bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 rounded-md font-medium">
                        Segunda Voz
                      </span>
                    </div>
                    <input
                      type="text"
                      value={speaker2.name}
                      onChange={(e) => setSpeaker2({ ...speaker2, name: e.target.value })}
                      placeholder="Nome na marcação (ex: Aluno)"
                      className="w-full text-xs p-2.5 border border-white/10 rounded-lg bg-[#0D0E12] outline-none font-semibold text-white focus:border-indigo-500"
                    />
                    <select
                      value={speaker2.voice}
                      onChange={(e) => setSpeaker2({ ...speaker2, voice: e.target.value })}
                      className="w-full text-xs p-2.5 border border-white/10 rounded-lg bg-[#0D0E12] outline-none font-medium text-white focus:border-indigo-500"
                    >
                      {GEMINI_VOICES.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} - {v.title} ({v.gender})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Style Selector */}
            <StyleSelector
              selectedStyle={selectedStyle}
              onSelectStyle={setSelectedStyle}
            />

            {/* Narration Pacing / Speed Selector */}
            <PacingSelector
              selectedPacing={selectedPacing}
              onSelectPacing={setSelectedPacing}
            />

            {/* Script Text Editor */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isDraggingStudioFile) setIsDraggingStudioFile(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingStudioFile(false);
              }}
              onDrop={handleStudioDrop}
              className={`bg-[#14161B] border rounded-2xl p-6 shadow-xl space-y-4 relative transition-all ${
                isDraggingStudioFile
                  ? 'border-indigo-500 bg-indigo-950/20 ring-2 ring-indigo-500/40'
                  : 'border-white/5'
              }`}
            >
              {isDraggingStudioFile && (
                <div className="absolute inset-0 bg-indigo-950/80 backdrop-blur-xs rounded-2xl border-2 border-dashed border-indigo-400 z-20 flex flex-col items-center justify-center text-center p-6 space-y-2 pointer-events-none animate-fade-in">
                  <FileText className="w-10 h-10 text-indigo-400 animate-bounce" />
                  <h4 className="text-base font-bold text-white">Solte o arquivo de texto aqui</h4>
                  <p className="text-xs text-indigo-200">
                    O conteúdo do arquivo será carregado diretamente no roteiro de narração
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <label className="text-sm font-bold text-white">
                    Roteiro de Narração (Português BR)
                  </label>
                </div>

                {/* AI Script Optimizer Drawer trigger */}
                <button
                  type="button"
                  onClick={() => setIsOptimizerModalOpen(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Otimizar Roteiro com IA</span>
                </button>
              </div>

              {/* Title input */}
              <input
                type="text"
                value={scriptTitle}
                onChange={(e) => setScriptTitle(e.target.value)}
                placeholder="Título do Roteiro / Capítulo..."
                className="w-full text-sm font-bold text-white border-b border-white/10 pb-2 focus:border-indigo-500 outline-none bg-transparent placeholder-slate-600"
              />

              {/* Quick Directives Insertion Bar */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400">
                  Inserir Marcações Diretas no Texto:
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
                  {[
                    { label: '+ Pausa 1s', tag: '[pausa de 1s]' },
                    { label: '+ Ênfase', tag: '[ênfase]' },
                    { label: '+ Tom Didático', tag: '[tom didático]' },
                    { label: '+ Ritmo Calmo', tag: '[ritmo calmo]' },
                  ].map((item) => (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => insertDirective(item.tag)}
                      className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg border border-white/10 font-mono transition-colors shrink-0"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                placeholder={
                  isMultiSpeaker
                    ? `Escreva o diálogo usando o nome dos personagens:\n\n${speaker1.name}: Olá, seja bem-vindo ao treinamento de hoje.\n${speaker2.name}: Obrigado! Quais são os tópicos principais?`
                    : 'Digite, cole ou arraste um arquivo de texto (.txt/.md) aqui com o roteiro em português...'
                }
                className="w-full h-44 p-4 text-sm bg-[#0D0E12] border border-white/10 rounded-xl focus:border-indigo-500 outline-none resize-none font-sans leading-relaxed text-slate-200 placeholder-slate-600"
              />

              {/* Metrics bar */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <div className="flex items-center space-x-4">
                  <span>
                    Palavras: <strong className="text-white">{wordCount}</strong>
                  </span>
                  <span>•</span>
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Duração Estimada: <strong className="text-indigo-400 font-mono">{formatTime(estimatedSeconds)}</strong>
                    </span>
                  </span>
                </div>

                <span className="text-[11px] text-slate-500">Suporta pontuação e termos em Português</span>
              </div>

              {/* Action Generate Button */}
              {errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleGenerateTTS}
                disabled={isGenerating || !scriptText.trim()}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm shadow-xl shadow-indigo-950/50 flex items-center justify-center space-x-2 transition-all hover:scale-[1.005] active:scale-[0.995]"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin text-white" />
                    <span>Sintetizando Narração com Gemini TTS...</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-5 h-5" />
                    <span>Gerar Narração em Áudio (PT-BR)</span>
                  </>
                )}
              </button>
            </div>

            {/* Audio Player Component when Audio is generated */}
            {generatedAudio && (
              <AudioPlayer
                audioUrl={generatedAudio.url}
                duration={generatedAudio.duration}
                title={generatedAudio.title}
                scriptText={scriptText}
                voiceName={generatedAudio.voiceUsed}
              />
            )}
          </div>
        )}

        {/* Tab 2: Multi-slide Course Manager */}
        {activeTab === 'course' && (
          <SlideCourseManager onSaveToHistory={saveToHistory} />
        )}

        {/* Tab 3: Template Library */}
        {activeTab === 'templates' && (
          <TemplateLibrary onSelectTemplate={handleSelectTemplate} />
        )}

        {/* Tab 4: History Panel */}
        {activeTab === 'history' && (
          <HistoryPanel
            history={history}
            onClearHistory={handleClearHistory}
            onRemoveHistoryItem={handleRemoveHistoryItem}
          />
        )}
      </main>

      {/* Script Optimizer Modal */}
      <ScriptOptimizerModal
        isOpen={isOptimizerModalOpen}
        onClose={() => setIsOptimizerModalOpen(false)}
        onApplyScript={(optimized) => setScriptText(optimized)}
      />

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#0F1115] py-6 mt-12 text-center text-xs text-slate-500">
        <p>
          VozTreina PT-BR • Estúdio de Text-to-Speech para Treinamentos Corporativos com{' '}
          <strong className="text-slate-300 font-mono">gemini-3.1-flash-tts-preview</strong>
        </p>
      </footer>
    </div>
  );
}
