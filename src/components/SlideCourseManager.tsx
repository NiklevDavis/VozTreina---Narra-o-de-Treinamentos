import React, { useState } from 'react';
import { ModuleSlide, GEMINI_VOICES, NarrationPacing, NARRATION_PACING_OPTIONS } from '../types';
import {
  Plus,
  Trash2,
  Play,
  Pause,
  Download,
  Layers,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FolderDown,
  Volume2,
  Video,
  FileImage,
  Upload,
  XCircle,
  Film,
} from 'lucide-react';
import { formatTime, estimateReadingTimeSeconds } from '../lib/audioUtils';
import { VideoMergeModal } from './VideoMergeModal';

interface SlideCourseManagerProps {
  onSaveToHistory: (title: string, text: string, audioUrl: string, duration: number, voice: string, style: string) => void;
}

export const SlideCourseManager: React.FC<SlideCourseManagerProps> = ({ onSaveToHistory }) => {
  const [courseId] = useState('main-course-1');
  const [courseTitle, setCourseTitle] = useState('Curso: Integração e Boas Práticas Corporativas');
  const [globalVoice, setGlobalVoice] = useState('Kore');
  const [globalStyle, setGlobalStyle] = useState('didatico');
  const [globalPacing, setGlobalPacing] = useState<NarrationPacing>('normal');

  const [slides, setSlides] = useState<ModuleSlide[]>([
    {
      id: '1',
      slideNumber: 1,
      title: 'Slide 1: Introdução e Boas-vindas',
      script: 'Seja bem-vindo ao treinamento de integração. Neste primeiro slide, abordaremos os objetivos do curso e nossa missão corporativa.',
      status: 'idle',
    },
    {
      id: '2',
      slideNumber: 2,
      title: 'Slide 2: Regras e Procedimentos',
      script: 'Para garantir o bom andamento da rotina, fique atento às regras internas de segurança, horários e utilização dos equipamentos.',
      status: 'idle',
    },
    {
      id: '3',
      slideNumber: 3,
      title: 'Slide 3: Encerramento e Próximos Passos',
      script: 'Concluímos este módulo. Lembre-se de realizar a avaliação prática ao final do capítulo no portal de treinamentos.',
      status: 'idle',
    },
  ]);

  // Load saved course from SQLite on mount
  React.useEffect(() => {
    fetch('/api/db/courses')
      .then((res) => res.json())
      .then((courses) => {
        if (Array.isArray(courses) && courses.length > 0) {
          const c = courses[0];
          if (c.title) setCourseTitle(c.title);
          if (c.globalVoice) setGlobalVoice(c.globalVoice);
          if (c.globalStyle) setGlobalStyle(c.globalStyle);
          if (c.globalPacing) setGlobalPacing(c.globalPacing as NarrationPacing);
          if (Array.isArray(c.slides) && c.slides.length > 0) {
            setSlides(c.slides);
          }
        }
      })
      .catch((err) => console.warn('Could not load course from SQLite:', err));
  }, []);

  // Auto-save course to SQLite
  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetch('/api/db/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: courseId,
          title: courseTitle,
          globalVoice,
          globalStyle,
          globalPacing,
          slides,
        }),
      }).catch((err) => console.warn('Error auto-saving course to SQLite:', err));
    }, 1000);

    return () => clearTimeout(timer);
  }, [courseId, courseTitle, globalVoice, globalStyle, globalPacing, slides]);

  const [currentlyPlayingSlideId, setCurrentlyPlayingSlideId] = useState<string | null>(null);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [dragOverSlideId, setDragOverSlideId] = useState<string | null>(null);

  // Handle slide image file upload
  const handleSlideImageUpload = (slideId: string, file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setSlides((prev) =>
        prev.map((s) => (s.id === slideId ? { ...s, imageUrl: dataUrl } : s))
      );
    };
    reader.readAsDataURL(file);
  };

  // Handle Drag & Drop of image or text files onto a slide
  const handleSlideDrop = (slideId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSlideId(null);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.type.startsWith('image/')) {
      handleSlideImageUpload(slideId, file);
    } else {
      // Treat as text/script file (.txt, .md, etc.)
      const reader = new FileReader();
      reader.onload = (event) => {
        const textContent = event.target?.result as string;
        if (textContent) {
          updateSlide(slideId, 'script', textContent);
        }
      };
      reader.readAsText(file);
    }
  };

  // Remove slide image
  const removeSlideImage = (slideId: string) => {
    setSlides((prev) =>
      prev.map((s) => (s.id === slideId ? { ...s, imageUrl: undefined } : s))
    );
  };

  // Add new slide
  const addSlide = () => {
    const nextNum = slides.length + 1;
    setSlides([
      ...slides,
      {
        id: Date.now().toString(),
        slideNumber: nextNum,
        title: `Slide ${nextNum}: Novo Tópico`,
        script: '',
        status: 'idle',
      },
    ]);
  };

  // Remove slide
  const removeSlide = (id: string) => {
    setSlides(slides.filter((s) => s.id !== id).map((s, idx) => ({ ...s, slideNumber: idx + 1 })));
  };

  // Update slide
  const updateSlide = (id: string, field: keyof ModuleSlide, value: any) => {
    setSlides(
      slides.map((s) => (s.id === id ? { ...s, [field]: value, status: 'idle', audioUrl: undefined } : s))
    );
  };

  const [batchStatusMessage, setBatchStatusMessage] = useState<string | null>(null);

  // Generate Audio for a Single Slide (with auto-retry for 429 rate limit)
  const generateSlideAudio = async (slideId: string, targetSlide?: ModuleSlide, isRetry = false): Promise<boolean> => {
    const slide = targetSlide || slides.find((s) => s.id === slideId);
    if (!slide || !slide.script.trim()) return false;

    setSlides((prev) =>
      prev.map((s) => (s.id === slideId ? { ...s, status: 'generating', errorMessage: undefined } : s))
    );

    try {
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: slide.script,
          voice: slide.voice || globalVoice,
          style: slide.style || globalStyle,
          pacing: slide.pacing || globalPacing,
        }),
      });

      const data = await res.json();
      if (res.ok && data.audioUrl) {
        setSlides((prev) =>
          prev.map((s) =>
            s.id === slideId
              ? {
                  ...s,
                  status: 'ready',
                  audioUrl: data.audioUrl,
                  duration: data.duration,
                }
              : s
          )
        );

        try {
          onSaveToHistory(
            `${courseTitle} - ${slide.title}`,
            slide.script,
            data.audioUrl,
            data.duration,
            slide.voice || globalVoice,
            slide.style || globalStyle
          );
        } catch (histErr) {
          console.warn("Nao foi possivel salvar historico do slide", histErr);
        }

        return true;
      } else if (res.status === 429 && !isRetry) {
        // Auto-retry once after 60s if rate limit 429 hit
        setSlides((prev) =>
          prev.map((s) =>
            s.id === slideId
              ? { ...s, status: 'generating', errorMessage: 'Cota atingida (10 req/min). Aguardando 60s para tentar novamente...' }
              : s
          )
        );
        await new Promise((resolve) => setTimeout(resolve, 60000));
        return generateSlideAudio(slideId, targetSlide, true);
      } else {
        throw new Error(data.error || 'Erro ao gerar áudio do slide');
      }
    } catch (err: any) {
      const msg = err.message || 'Erro de conexão ou limite de requisições excedido.';
      setSlides((prev) =>
        prev.map((s) =>
          s.id === slideId ? { ...s, status: 'error', errorMessage: msg } : s
        )
      );
      return false;
    }
  };

  // Generate All Audio in Batch with mathematically safe rate-limit delay (6.5s)
  const generateAllSlidesAudio = async () => {
    setIsGeneratingBatch(true);
    const validSlides = slides.filter((s) => s.script.trim());
    
    for (let i = 0; i < validSlides.length; i++) {
      const slide = validSlides[i];
      setBatchStatusMessage(`Gerando slide ${i + 1} de ${validSlides.length}...`);
      
      await generateSlideAudio(slide.id, slide);
      
      // 6.5 second delay between sequential batch TTS requests (ensures max 9 requests/minute, avoiding 10 req/min limit)
      if (i < validSlides.length - 1) {
        for (let countdown = 6; countdown > 0; countdown--) {
          setBatchStatusMessage(`Slide ${i + 1}/${validSlides.length} concluído. Pausa anti-bloqueio (cota 10 req/min): ${countdown}s...`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
    setBatchStatusMessage(null);
    setIsGeneratingBatch(false);
  };

  // Total course estimated duration
  const totalDuration = slides.reduce((acc, curr) => {
    return acc + (curr.duration || estimateReadingTimeSeconds(curr.script));
  }, 0);

  return (
    <div className="space-y-6">
      {/* Course Header Banner */}
      <div className="bg-[#0F1115] text-white rounded-2xl p-6 shadow-xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span className="bg-indigo-600 text-white text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-md">
              Gerenciador por Slides / Módulos
            </span>
            <span className="text-xs text-slate-400">Total: {slides.length} Slides</span>
          </div>
          <input
            type="text"
            value={courseTitle}
            onChange={(e) => setCourseTitle(e.target.value)}
            className="text-xl sm:text-2xl font-bold bg-transparent border-b border-white/10 focus:border-indigo-500 outline-none w-full text-white"
          />
          <p className="text-xs text-slate-400">
            Duração total estimada do curso em áudio: <span className="text-indigo-400 font-mono font-semibold">{formatTime(totalDuration)}</span>
          </p>
        </div>

        {/* Global Settings & Batch Action */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-white/5 border border-white/10 p-2 rounded-xl text-xs">
            <span className="text-slate-400">Voz Padrão:</span>
            <select
              value={globalVoice}
              onChange={(e) => setGlobalVoice(e.target.value)}
              className="bg-[#0D0E12] border border-white/10 text-white rounded-lg px-2 py-1 outline-none font-medium"
            >
              {GEMINI_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.gender})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2 bg-white/5 border border-white/10 p-2 rounded-xl text-xs">
            <span className="text-slate-400">Ritmo Padrão:</span>
            <select
              value={globalPacing}
              onChange={(e) => setGlobalPacing(e.target.value as NarrationPacing)}
              className="bg-[#0D0E12] border border-white/10 text-white rounded-lg px-2 py-1 outline-none font-medium"
            >
              {NARRATION_PACING_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.speedTag})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={generateAllSlidesAudio}
            disabled={isGeneratingBatch}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs shadow-lg shadow-indigo-900/30 flex items-center space-x-2 transition-all"
          >
            {isGeneratingBatch ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-300" />
                <span>{batchStatusMessage || 'Gerando Módulos em Lote...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Gerar Áudio de Todos os Slides</span>
              </>
            )}
          </button>

          <button
            onClick={() => setIsMergeModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 flex items-center space-x-2 transition-all"
          >
            <Video className="w-4 h-4 text-emerald-200" />
            <span>Exportar Vídeo do Módulo (Merge)</span>
          </button>
        </div>
      </div>

      {/* Slide Cards List */}
      <div className="space-y-4">
        {slides.map((slide) => {
          const isDragOver = dragOverSlideId === slide.id;
          return (
            <div
              key={slide.id}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dragOverSlideId !== slide.id) setDragOverSlideId(slide.id);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dragOverSlideId === slide.id) setDragOverSlideId(null);
              }}
              onDrop={(e) => handleSlideDrop(slide.id, e)}
              className={`bg-[#14161B] border rounded-2xl p-5 shadow-xl transition-all space-y-4 text-slate-200 relative ${
                isDragOver
                  ? 'border-indigo-500 bg-indigo-950/20 ring-2 ring-indigo-500/40'
                  : 'border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/5">
                <div className="flex items-center space-x-3">
                  <span className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                    {slide.slideNumber}
                  </span>
                  <input
                    type="text"
                    value={slide.title}
                    onChange={(e) => updateSlide(slide.id, 'title', e.target.value)}
                    className="font-bold text-white text-sm sm:text-base border-b border-transparent hover:border-white/20 focus:border-indigo-500 outline-none w-full sm:w-80 bg-transparent"
                  />
                </div>

                {/* Status and Action Buttons */}
                <div className="flex items-center space-x-2">
                  {slide.status === 'generating' && (
                    <span className="flex items-center space-x-1.5 text-xs text-indigo-400 font-semibold bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Gerando...</span>
                    </span>
                  )}

                  {slide.status === 'ready' && (
                    <span className="flex items-center space-x-1 text-xs text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Pronto ({formatTime(slide.duration || 0)})</span>
                    </span>
                  )}

                  {slide.status === 'error' && (
                    <span
                      className="flex items-center space-x-1 text-xs text-rose-400 font-semibold bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg"
                      title={slide.errorMessage || 'Falha ao gerar o áudio deste slide'}
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span className="max-w-[160px] truncate">{slide.errorMessage || 'Erro'}</span>
                    </span>
                  )}

                  <button
                    onClick={() => generateSlideAudio(slide.id)}
                    disabled={slide.status === 'generating' || !slide.script.trim()}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-indigo-900/30 flex items-center space-x-1 transition-all"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Gerar Slide</span>
                  </button>

                  {slides.length > 1 && (
                    <button
                      onClick={() => removeSlide(slide.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Slide Visual Image & Script Split Layout */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Slide Image Attachment / Preview */}
                <div className="md:col-span-1 bg-[#0D0E12] border border-white/10 rounded-xl p-3 flex flex-col items-center justify-center min-h-[120px] relative group overflow-hidden">
                  {slide.imageUrl ? (
                    <div className="relative w-full h-28 rounded-lg overflow-hidden group">
                      <img
                        src={slide.imageUrl}
                        alt={slide.title}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removeSlideImage(slide.id)}
                        className="absolute top-1 right-1 bg-black/70 text-rose-400 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black"
                        title="Remover Imagem"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                      <span className="absolute bottom-1 left-1 bg-black/60 text-white font-mono text-[9px] px-1.5 py-0.5 rounded backdrop-blur-xs">
                        Imagem Anexada
                      </span>
                    </div>
                  ) : (
                    <label
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => handleSlideDrop(slide.id, e)}
                      className={`w-full h-full flex flex-col items-center justify-center p-3 border border-dashed rounded-lg cursor-pointer transition-all text-center ${
                        isDragOver
                          ? 'border-indigo-400 bg-indigo-500/20 text-white'
                          : 'border-white/10 hover:border-indigo-500/50 bg-white/2 hover:bg-white/5 text-slate-200'
                      }`}
                    >
                      <FileImage className="w-6 h-6 text-indigo-400 mb-1" />
                      <span className="text-xs font-bold">Anexar Slide (Imagem / PNG)</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">Clique ou arraste a imagem / arquivo de texto aqui</span>
                      <input
                        type="file"
                        accept="image/*,.txt,.md"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.type.startsWith('image/')) {
                              handleSlideImageUpload(slide.id, file);
                            } else {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                const textContent = ev.target?.result as string;
                                if (textContent) updateSlide(slide.id, 'script', textContent);
                              };
                              reader.readAsText(file);
                            }
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

              {/* Script Textarea for Slide */}
              <div className="md:col-span-2">
                <textarea
                  value={slide.script}
                  onChange={(e) => updateSlide(slide.id, 'script', e.target.value)}
                  placeholder="Digite ou cole aqui o texto que será narrado no slide..."
                  className="w-full h-28 p-3 text-sm bg-[#0D0E12] border border-white/10 rounded-xl focus:border-indigo-500 outline-none resize-none text-slate-200 placeholder-slate-600"
                />
              </div>
            </div>

            {/* Audio Playback for Slide */}
            {slide.audioUrl && (
              <div className="bg-[#0D0E12] border border-white/5 p-3 rounded-xl flex items-center justify-between">
                <audio src={slide.audioUrl} controls className="h-8 w-full max-w-md accent-indigo-500" />
                <a
                  href={slide.audioUrl}
                  download={`${courseTitle.toLowerCase().replace(/\s+/g, '_')}_slide_${slide.slideNumber}.wav`}
                  className="flex items-center space-x-1 text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar WAV</span>
                </a>
              </div>
            )}
          </div>
        );
      })}
      </div>

      {/* Add Slide Button */}
      <button
        onClick={addSlide}
        className="w-full py-3.5 rounded-2xl border border-dashed border-white/10 hover:border-indigo-500 text-slate-400 hover:text-white font-semibold text-sm flex items-center justify-center space-x-2 transition-all bg-[#14161B] hover:bg-white/5"
      >
        <Plus className="w-4 h-4 text-indigo-400" />
        <span>Adicionar Novo Slide ao Curso</span>
      </button>

      {/* Video Merge & Export Modal */}
      <VideoMergeModal
        courseTitle={courseTitle}
        slides={slides}
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        onGenerateMissingAudio={generateAllSlidesAudio}
      />
    </div>
  );
};
