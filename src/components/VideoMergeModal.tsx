import React, { useState, useRef, useEffect } from 'react';
import { ModuleSlide } from '../types';
import {
  Video,
  X,
  Play,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Film,
  Sparkles,
  Layers,
  FileImage,
  Clock,
  Volume2,
} from 'lucide-react';
import { formatTime } from '../lib/audioUtils';

interface VideoMergeModalProps {
  courseTitle: string;
  slides: ModuleSlide[];
  isOpen: boolean;
  onClose: () => void;
  onGenerateMissingAudio: () => Promise<void>;
}

export const VideoMergeModal: React.FC<VideoMergeModalProps> = ({
  courseTitle,
  slides,
  isOpen,
  onClose,
  onGenerateMissingAudio,
}) => {
  const [status, setStatus] = useState<'idle' | 'preparing' | 'rendering' | 'ready' | 'error'>('idle');
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGeneratingMissing, setIsGeneratingMissing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  if (!isOpen) return null;

  const missingAudioCount = slides.filter((s) => !s.audioUrl && s.script.trim()).length;
  const totalDuration = slides.reduce((acc, curr) => acc + (curr.duration || 10), 0);

  const handleFixMissingAudio = async () => {
    setIsGeneratingMissing(true);
    try {
      await onGenerateMissingAudio();
    } catch (err: any) {
      setErrorMessage('Erro ao gerar áudios pendentes: ' + err.message);
    } finally {
      setIsGeneratingMissing(false);
    }
  };

  const startVideoMerge = async () => {
    const readySlides = slides.filter((s) => s.audioUrl && s.script.trim());
    if (readySlides.length === 0) {
      setErrorMessage('Nenhum slide possui áudio gerado. Por favor, gere os áudios dos slides primeiro.');
      return;
    }

    setStatus('rendering');
    setErrorMessage(null);
    setProgressPercent(0);
    setCurrentSlideIdx(0);

    const width = 1280;
    const height = 720;

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setStatus('error');
      setErrorMessage('Não foi possível inicializar o renderizador 2D.');
      return;
    }

    // Audio Context & Destination stream
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const destNode = audioCtx.createMediaStreamDestination();

    // Canvas Video Stream
    const canvasStream = canvas.captureStream(30); // 30 FPS

    // Combined Track Stream
    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...destNode.getAudioTracks(),
    ]);

    let mediaRecorder: MediaRecorder;
    const chunks: Blob[] = [];

    try {
      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
      mediaRecorder = new MediaRecorder(combinedStream, { mimeType });
    } catch (err) {
      mediaRecorder = new MediaRecorder(combinedStream);
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'video/webm' });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setStatus('ready');
      setProgressPercent(100);
      audioCtx.close();
    };

    mediaRecorder.start();

    // Preload Slide Images if present
    const loadedImages: { [key: string]: HTMLImageElement } = {};
    for (const slide of readySlides) {
      if (slide.imageUrl) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = slide.imageUrl;
          await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
          loadedImages[slide.id] = img;
        } catch (e) {
          console.warn('Failed to load image for slide', slide.id);
        }
      }
    }

    // Render loop and slide playback sequence
    let accumulatedTime = 0;

    for (let i = 0; i < readySlides.length; i++) {
      const slide = readySlides[i];
      setCurrentSlideIdx(i);

      // Create audio element for this slide
      const audioElement = new Audio(slide.audioUrl);
      audioElement.crossOrigin = 'anonymous';
      const audioSource = audioCtx.createMediaElementSource(audioElement);
      audioSource.connect(destNode);
      audioSource.connect(audioCtx.destination); // For live monitoring

      await new Promise<void>((resolve) => {
        let isDone = false;

        const drawSlideFrame = (currentTime: number) => {
          if (isDone) return;

          // Clear Canvas
          ctx.fillStyle = '#0F1115';
          ctx.fillRect(0, 0, width, height);

          // Draw Background Image or Theme
          const slideImg = loadedImages[slide.id];
          if (slideImg && slideImg.complete && slideImg.naturalWidth > 0) {
            // Draw uploaded slide image full or contained
            const imgAspect = slideImg.naturalWidth / slideImg.naturalHeight;
            const canvasAspect = width / height;

            if (imgAspect > canvasAspect) {
              const h = width / imgAspect;
              const y = (height - h) / 2;
              ctx.drawImage(slideImg, 0, y, width, h);
            } else {
              const w = height * imgAspect;
              const x = (width - w) / 2;
              ctx.drawImage(slideImg, x, 0, w, height);
            }

            // Dark overlay gradient at bottom for subtitle overlay readability
            const gradient = ctx.createLinearGradient(0, height - 200, 0, height);
            gradient.addColorStop(0, 'rgba(15, 17, 21, 0)');
            gradient.addColorStop(1, 'rgba(15, 17, 21, 0.95)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, height - 200, width, 200);
          } else {
            // Draw Elegant Presentation Theme Graphic
            const grad = ctx.createLinearGradient(0, 0, width, height);
            grad.addColorStop(0, '#0F1117');
            grad.addColorStop(0.5, '#181A22');
            grad.addColorStop(1, '#0A0B0E');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);

            // Subtle Background Grid or Accent Geometry
            ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
            ctx.lineWidth = 1;
            for (let x = 0; x < width; x += 40) {
              ctx.beginPath();
              ctx.moveTo(x, 0);
              ctx.lineTo(x, height);
              ctx.stroke();
            }
            for (let y = 0; y < height; y += 40) {
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.lineTo(width, y);
              ctx.stroke();
            }

            // Slide Card Container in center
            ctx.fillStyle = '#14161B';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
            ctx.shadowBlur = 30;
            ctx.beginPath();
            ctx.roundRect(80, 80, width - 160, height - 200, 20);
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Slide Number Badge
            ctx.fillStyle = '#4F46E5';
            ctx.beginPath();
            ctx.roundRect(110, 110, 110, 32, 8);
            ctx.fill();

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText(`SLIDE ${slide.slideNumber}`, 125, 131);

            // Course Title
            ctx.fillStyle = '#94A3B8';
            ctx.font = '600 15px sans-serif';
            ctx.fillText(courseTitle.toUpperCase(), 240, 131);

            // Slide Title
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 32px sans-serif';
            
            // Wrap Slide Title
            const words = slide.title.split(' ');
            let line = '';
            let lineY = 200;
            for (let n = 0; n < words.length; n++) {
              const testLine = line + words[n] + ' ';
              const metrics = ctx.measureText(testLine);
              if (metrics.width > width - 260 && n > 0) {
                ctx.fillText(line, 110, lineY);
                line = words[n] + ' ';
                lineY += 42;
              } else {
                line = testLine;
              }
            }
            ctx.fillText(line, 110, lineY);

            // Script Text Preview
            ctx.fillStyle = '#CBD5E1';
            ctx.font = '20px sans-serif';
            const scriptWords = slide.script.split(' ');
            let sLine = '';
            let sY = lineY + 50;
            for (let k = 0; k < scriptWords.length; k++) {
              const testS = sLine + scriptWords[k] + ' ';
              if (ctx.measureText(testS).width > width - 260 && k > 0) {
                ctx.fillText(sLine, 110, sY);
                sLine = scriptWords[k] + ' ';
                sY += 32;
                if (sY > height - 160) break; // limit lines
              } else {
                sLine = testS;
              }
            }
            if (sY <= height - 160) {
              ctx.fillText(sLine, 110, sY);
            }
          }

          // Top Header Banner
          ctx.fillStyle = 'rgba(15, 17, 21, 0.85)';
          ctx.fillRect(0, 0, width, 50);

          ctx.fillStyle = '#818CF8';
          ctx.font = 'bold 16px sans-serif';
          ctx.fillText(`VozTreina PT-BR • ${courseTitle}`, 30, 31);

          ctx.fillStyle = '#94A3B8';
          ctx.font = '14px font-mono';
          ctx.fillText(` Slide ${i + 1} de ${readySlides.length}`, width - 160, 31);

          // Bottom Bar & Waveform / Progress
          const slideAudioDuration = audioElement.duration || slide.duration || 10;
          const currentAudioTime = audioElement.currentTime || 0;
          const slideRatio = currentAudioTime / slideAudioDuration;

          const totalProg = ((accumulatedTime + currentAudioTime) / totalDuration) * 100;
          setProgressPercent(Math.min(99, Math.round(totalProg)));

          // Progress Line at bottom
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.fillRect(0, height - 12, width, 12);

          ctx.fillStyle = '#6366F1';
          ctx.fillRect(0, height - 12, width * (totalProg / 100), 12);

          // Animated Audio Waveform Bar at bottom left
          ctx.fillStyle = '#818CF8';
          const barCount = 30;
          const startX = 30;
          const startY = height - 40;
          for (let b = 0; b < barCount; b++) {
            const h = Math.abs(Math.sin(currentTime * 0.005 + b * 0.4) * 20) + 4;
            ctx.fillRect(startX + b * 8, startY - h / 2, 5, h);
          }

          // Timer readout
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 14px font-mono';
          ctx.fillText(
            `${formatTime(accumulatedTime + currentAudioTime)} / ${formatTime(totalDuration)}`,
            width - 160,
            height - 35
          );

          animationFrameRef.current = requestAnimationFrame((t) => drawSlideFrame(t));
        };

        audioElement.onended = () => {
          isDone = true;
          accumulatedTime += audioElement.duration || slide.duration || 10;
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
          resolve();
        };

        audioElement.onerror = () => {
          isDone = true;
          accumulatedTime += 5;
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
          resolve();
        };

        // Start playback
        audioElement.play().catch(() => {
          isDone = true;
          resolve();
        });

        // Trigger canvas frame loop
        animationFrameRef.current = requestAnimationFrame((t) => drawSlideFrame(t));
      });
    }

    // Finish recording
    setTimeout(() => {
      mediaRecorder.stop();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#14161B] border border-white/10 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0F1115] border-b border-white/5 text-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/40">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base">Exportar Vídeo Completo do Módulo</h3>
              <p className="text-xs text-slate-400">
                Junte slides (imagens/layouts) + narrações em um único arquivo de vídeo HD
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Missing Audio Alert Banner */}
          {missingAudioCount > 0 && status === 'idle' && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Existem <strong>{missingAudioCount}</strong> slide(s) sem áudio gerado. Gere todos os áudios antes de mesclar.
                </span>
              </div>
              <button
                onClick={handleFixMissingAudio}
                disabled={isGeneratingMissing}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 flex items-center space-x-1.5 transition-all"
              >
                {isGeneratingMissing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Gerando Pendentes...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Gerar Áudios Agora</span>
                  </>
                )}
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Canvas Preview Area during rendering */}
          <div className="relative rounded-xl overflow-hidden bg-black border border-white/10 aspect-video flex items-center justify-center">
            {status === 'ready' && videoUrl ? (
              <video
                src={videoUrl}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            ) : (
              <>
                <canvas
                  ref={canvasRef}
                  width={1280}
                  height={720}
                  className={`w-full h-full object-contain ${
                    status === 'rendering' ? 'block' : 'hidden'
                  }`}
                />

                {status === 'idle' && (
                  <div className="text-center p-6 space-y-3 max-w-md">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
                      <Film className="w-7 h-7" />
                    </div>
                    <h4 className="font-bold text-white text-base">Pronto para Renderizar Vídeo HD</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      O estúdio irá mesclar {slides.length} slide(s) com suas respectivas narrações em áudio, sincronizando imagens, legendas e barras de progresso.
                    </p>
                  </div>
                )}

                {status === 'rendering' && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex flex-col items-center justify-end p-6 pointer-events-none">
                    <div className="w-full max-w-lg bg-[#0F1115] border border-white/10 p-4 rounded-xl space-y-2 text-center shadow-2xl">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-indigo-400 flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Processando Slide {currentSlideIdx + 1} de {slides.length}...
                        </span>
                        <span className="font-mono text-white">{progressPercent}%</span>
                      </div>
                      <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Slide Overview List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center justify-between">
              <span>Conteúdo do Módulo ({slides.length} Slides)</span>
              <span className="font-mono text-indigo-400">Duração Total: {formatTime(totalDuration)}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
              {slides.map((s, idx) => (
                <div
                  key={s.id}
                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                    currentSlideIdx === idx && status === 'rendering'
                      ? 'bg-indigo-500/20 border-indigo-500 text-white'
                      : 'bg-[#0D0E12] border-white/5 text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <span className="w-5 h-5 rounded bg-white/10 text-slate-300 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                      {s.slideNumber}
                    </span>
                    <span className="truncate font-medium">{s.title}</span>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0 text-[10px]">
                    {s.imageUrl ? (
                      <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <FileImage className="w-3 h-3" />
                        <span>Imagem</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">Layout IA</span>
                    )}

                    {s.audioUrl ? (
                      <span className="text-indigo-300 font-mono bg-indigo-500/10 px-1.5 py-0.5 rounded">
                        {formatTime(s.duration || 0)}
                      </span>
                    ) : (
                      <span className="text-amber-400 font-semibold bg-amber-500/10 px-1.5 py-0.5 rounded">Sem Áudio</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#0F1115] border-t border-white/5 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            Fechar
          </button>

          <div className="flex items-center space-x-3">
            {status === 'ready' && videoUrl ? (
              <a
                href={videoUrl}
                download={`${courseTitle.toLowerCase().replace(/\s+/g, '_')}_modulo_completo.webm`}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-2 shadow-lg shadow-emerald-900/30 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Baixar Vídeo (.webm / MP4)</span>
              </a>
            ) : (
              <button
                onClick={startVideoMerge}
                disabled={status === 'rendering' || missingAudioCount > 0}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center space-x-2 shadow-lg shadow-indigo-900/30 transition-all"
              >
                {status === 'rendering' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Mesclando Slides + Áudios...</span>
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4" />
                    <span>Iniciar Merge e Gerar Vídeo</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
