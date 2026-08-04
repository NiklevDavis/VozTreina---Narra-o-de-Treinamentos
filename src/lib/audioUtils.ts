/**
 * Utility functions for Web Audio, waveform visualization, and ambient background audio generation
 */

// Generate background ambient synth sound if requested using Web Audio API
export async function createAudioWithBackground(
  speechAudioUrl: string,
  ambientTrack: 'none' | 'soft' | 'tech' | 'calm',
  ambientVolume = 0.12
): Promise<string> {
  if (ambientTrack === 'none') {
    return speechAudioUrl;
  }

  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    // Fetch speech audio buffer
    const speechRes = await fetch(speechAudioUrl);
    const speechArrayBuffer = await speechRes.arrayBuffer();
    const speechAudioBuffer = await audioCtx.decodeAudioData(speechArrayBuffer);

    const duration = speechAudioBuffer.duration;
    const sampleRate = speechAudioBuffer.sampleRate;
    const numberOfChannels = speechAudioBuffer.numberOfChannels;

    // Offline Audio Context for rendering combined audio
    const offlineCtx = new OfflineAudioContext(numberOfChannels, Math.ceil(duration * sampleRate), sampleRate);

    // 1. Speech Source
    const speechSource = offlineCtx.createBufferSource();
    speechSource.buffer = speechAudioBuffer;
    speechSource.connect(offlineCtx.destination);

    // 2. Synthesize gentle ambient background track
    const ambientGain = offlineCtx.createGain();
    ambientGain.gain.setValueAtTime(ambientVolume, 0);
    // Fade out at end
    ambientGain.gain.exponentialRampToValueAtTime(0.001, duration);
    ambientGain.connect(offlineCtx.destination);

    // Create chords based on ambient track theme
    const frequencies = ambientTrack === 'tech'
      ? [220, 277.18, 329.63, 440] // A major tech chord
      : ambientTrack === 'calm'
      ? [174.61, 220, 261.63, 329.63] // F maj7 calm chord
      : [196, 246.94, 293.66, 392]; // G major soft corporate pad

    frequencies.forEach((freq, idx) => {
      const osc = offlineCtx.createOscillator();
      osc.type = ambientTrack === 'tech' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, 0);

      // Low pass filter to make background non-intrusive
      const filter = offlineCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(500 + idx * 100, 0);

      // LFO for subtle breathing movement
      const lfo = offlineCtx.createOscillator();
      lfo.frequency.setValueAtTime(0.2, 0); // 0.2 Hz slow breath
      const lfoGain = offlineCtx.createGain();
      lfoGain.gain.setValueAtTime(0.03, 0);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      osc.connect(filter);
      filter.connect(ambientGain);

      osc.start(0);
      osc.stop(duration);
      lfo.start(0);
      lfo.stop(duration);
    });

    speechSource.start(0);

    const renderedBuffer = await offlineCtx.startRendering();

    // Convert AudioBuffer to WAV blob
    const wavBlob = audioBufferToWavBlob(renderedBuffer);
    return URL.createObjectURL(wavBlob);
  } catch (err) {
    console.warn("Could not mix ambient audio, falling back to speech only:", err);
    return speechAudioUrl;
  }
}

/**
 * Converts AudioBuffer to WAV Blob
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const outBuffer = new ArrayBuffer(length);
  const view = new DataView(outBuffer);
  const channels: Float32Array[] = [];
  let sample = 0;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952);                         // "RIFF"
  setUint32(length - 8);                         // file length - 8
  setUint32(0x45564157);                         // "WAVE"

  setUint32(0x20746d66);                         // "fmt " chunk
  setUint32(16);                                 // length = 16
  setUint16(1);                                  // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2);                      // block-align
  setUint16(16);                                 // 16-bit

  setUint32(0x61746164);                         // "data" chunk
  setUint32(length - pos - 4);                   // chunk length

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (offset < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([outBuffer], { type: 'audio/wav' });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}

/**
 * Helper to estimate word count and audio duration for PT-BR
 */
export function estimateReadingTimeSeconds(text: string): number {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).length;
  // PT-BR training narration is ~135 words per minute
  const seconds = Math.ceil((words / 135) * 60);
  return seconds;
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}
