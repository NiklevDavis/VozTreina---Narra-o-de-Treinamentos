import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Download,
  Volume2,
  VolumeX,
  FileText,
  RotateCcw,
  Sparkles,
  Music,
  Check,
  RefreshCw,
  Gauge,
} from 'lucide-react';
import { createAudioWithBackground, formatTime } from '../lib/audioUtils';

interface AudioPlayerProps {
  audioUrl: string;
  duration: number;
  title: string;
  scriptText: string;
  voiceName: string;
  onGenerateSubtitles?: (vtt: string) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  duration,
  title,
  scriptText,
  voiceName,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);

  // Ambient music mixing
  const [activeAudioUrl, setActiveAudioUrl] = useState(audioUrl);
  const [ambientTrack, setAmbientTrack] = useState<'none' | 'soft' | 'tech' | 'calm'>('none');
  const [isMixing, setIsMixing] = useState(false);

  // Subtitle generation state
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState(false);
  const [vttSubtitles, setVttSubtitles] = useState<string | null>(null);

  // Sync active audio URL when audioUrl prop changes
  useEffect(() => {
    setActiveAudioUrl(audioUrl);
    setAmbientTrack('none');
    setIsPlaying(false);
    setCurrentTime(0);
  }, [audioUrl]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [activeAudioUrl]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  // Handle seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  // Handle speed change
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  // Handle volume
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 1.0;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  // Ambient music remixing
  const handleAmbientChange = async (track: 'none' | 'soft' | 'tech' | 'calm') => {
    setAmbientTrack(track);
    setIsMixing(true);
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(false);

    try {
      const mixedUrl = await createAudioWithBackground(audioUrl, track, 0.12);
      setActiveAudioUrl(mixedUrl);
    } catch (err) {
      console.error("Error creating ambient audio track:", err);
    } finally {
      setIsMixing(false);
    }
  };

  // Canvas visualizer waveform drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const barWidth = 3;
      const gap = 2;
      const barCount = Math.floor(width / (barWidth + gap));
      const progress = duration > 0 ? currentTime / duration : 0;

      for (let i = 0; i < barCount; i++) {
        const x = i * (barWidth + gap);
        // Generate pseudo waveform height based on position and current playback
        const seed = (i * 997) % 100;
        const normalizedSeed = (Math.sin(i * 0.15) + 1) / 2;
        let barHeight = Math.max(6, normalizedSeed * (height - 10));

        if (isPlaying) {
          const dynamicBoost = Math.sin(Date.now() * 0.008 + i * 0.2) * 8;
          barHeight = Math.min(height - 4, Math.max(6, barHeight + dynamicBoost));
        }

        const barProgress = i / barCount;
        if (barProgress <= progress) {
          ctx.fillStyle = '#6366f1'; // Active Indigo
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; // Inactive dark bar
        }

        const y = (height - barHeight) / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      if (isPlaying) {
        animationId = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [currentTime, duration, isPlaying]);

  // Subtitle generation function
  const handleGenerateSubtitles = async () => {
    setIsGeneratingSubtitles(true);
    try {
      const res = await fetch('/api/script/generate-subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: scriptText, durationSeconds: duration }),
      });
      const data = await res.json();
      if (data.vttContent) {
        setVttSubtitles(data.vttContent);
      }
    } catch (err) {
      console.error("Error generating subtitles:", err);
    } finally {
      setIsGeneratingSubtitles(false);
    }
  };

  // Download VTT File
  const downloadVtt = () => {
    if (!vttSubtitles) return;
    const blob = new Blob([vttSubtitles], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `legendas-${title.toLowerCase().replace(/\s+/g, '-')}.vtt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="bg-[#14161B] border border-white/5 rounded-2xl p-6 shadow-xl space-y-5">
      <audio ref={audioRef} src={activeAudioUrl} preload="auto" />

      {/* Header info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/5">
        <div>
          <span className="text-[11px] uppercase font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-md">
            Áudio Gerado com Sucesso
          </span>
          <h3 className="text-base font-bold text-white mt-2">{title || 'Narração de Treinamento'}</h3>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span className="font-semibold text-slate-300">Voz:</span>
          <span className="bg-white/5 border border-white/10 px-2 py-1 rounded-md text-slate-200 font-medium">{voiceName}</span>
          <span>•</span>
          <span className="font-semibold text-slate-300">Duração:</span>
          <span className="font-mono text-indigo-400">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Waveform Canvas */}
      <div className="bg-[#0D0E12] border border-white/5 rounded-xl p-4 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={600}
          height={60}
          className="w-full h-14 cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickPos = (e.clientX - rect.left) / rect.width;
            const newTime = clickPos * duration;
            setCurrentTime(newTime);
            if (audioRef.current) audioRef.current.currentTime = newTime;
          }}
        />

        {/* Seek Bar Input overlay */}
        <input
          type="range"
          min="0"
          max={duration || 100}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1 bg-transparent appearance-none cursor-pointer absolute bottom-2 left-0 right-0 px-4 opacity-0"
        />
      </div>

      {/* Playback Controls & Time */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Play/Pause & Seek Time */}
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button
            onClick={togglePlay}
            disabled={isMixing}
            className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-900/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>

          <div className="font-mono text-xs text-slate-400 font-medium">
            <span className="text-white font-bold">{formatTime(currentTime)}</span> / {formatTime(duration)}
          </div>
        </div>

        {/* Speed Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-2 bg-white/5 border border-white/5 p-2 rounded-xl text-xs">
          <div className="flex items-center space-x-1 text-slate-300 font-semibold shrink-0">
            <Gauge className="w-3.5 h-3.5 text-indigo-400" />
            <span>Velocidade:</span>
          </div>

          <div className="flex items-center space-x-1 overflow-x-auto">
            {[
              { val: 0.75, label: '0.75x' },
              { val: 1.0, label: '1.0x' },
              { val: 1.25, label: '1.25x' },
              { val: 1.5, label: '1.5x' },
              { val: 2.0, label: '2.0x' },
            ].map((item) => (
              <button
                key={item.val}
                onClick={() => handleSpeedChange(item.val)}
                className={`px-2 py-1 rounded-md font-mono text-[11px] font-semibold transition-all ${
                  playbackSpeed === item.val
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-1 pl-1 border-l border-white/10 shrink-0">
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={playbackSpeed}
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              className="w-16 accent-indigo-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
              title="Ajuste fino de velocidade"
            />
            <span className="font-mono text-[10px] text-indigo-300 font-bold w-9 text-right">
              {playbackSpeed.toFixed(2)}x
            </span>
          </div>
        </div>

        {/* Volume */}
        <div className="flex items-center space-x-2 text-slate-400">
          <button onClick={toggleMute} className="hover:text-white transition-colors">
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 accent-indigo-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Ambient Music Mixer & Download Section */}
      <div className="pt-3 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
        {/* Ambient background selector */}
        <div className="flex items-center space-x-2">
          <Music className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-300 shrink-0">Música de Fundo:</span>
          <div className="flex items-center space-x-1 overflow-x-auto text-[11px]">
            {[
              { id: 'none', label: 'Sem Fundo' },
              { id: 'soft', label: 'Suave' },
              { id: 'calmo', label: 'Foco' },
              { id: 'tech', label: 'Tech' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => handleAmbientChange(item.id as any)}
                disabled={isMixing}
                className={`px-2 py-1 rounded-md transition-all ${
                  ambientTrack === item.id
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
            {isMixing && <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin" />}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end space-x-2">
          {/* Subtitles VTT Button */}
          {!vttSubtitles ? (
            <button
              onClick={handleGenerateSubtitles}
              disabled={isGeneratingSubtitles}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 hover:text-white text-xs font-medium transition-all"
            >
              {isGeneratingSubtitles ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                  <span>Gerando Legenda...</span>
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Gerar Legenda VTT</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={downloadVtt}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 text-xs font-semibold transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Legenda (.vtt)</span>
            </button>
          )}

          {/* Download Audio WAV Button */}
          <a
            href={activeAudioUrl}
            download={`narracao-${title.toLowerCase().replace(/\s+/g, '-') || 'treinamento'}.wav`}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-900/30 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar Áudio (.wav)</span>
          </a>
        </div>
      </div>
    </div>
  );
};
