import express from "express";
import path from "path";
import fs from "fs";
import { createRequire } from "module";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Modality } from "@google/genai";
import {
  initDb,
  getHistory,
  addHistoryItem,
  deleteHistoryItem,
  clearHistory,
  getCourses,
  saveCourse,
  deleteCourse,
} from "./db";

dotenv.config();

const appRequire = createRequire(path.join(process.cwd(), "package.json"));

// Inicializar banco de dados SQLite local
initDb();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "25mb" }));

// Initialize Gemini client with system User-Agent
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

/**
 * Converts raw 24kHz 16-bit mono PCM buffer to a valid WAV Buffer
 */
function pcmToWavBuffer(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  // RIFF descriptor
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);

  // "fmt " sub-chunk
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size
  header.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // ByteRate
  header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // BlockAlign
  header.writeUInt16LE(bitsPerSample, 34);

  // "data" sub-chunk
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

/**
 * Converts Float32 PCM array (-1.0 to 1.0) to valid 16-bit WAV Buffer
 */
function floatToPcmWavBuffer(pcmFloat32Array: Float32Array, sampleRate = 22050): Buffer {
  const numSamples = pcmFloat32Array.length;
  const pcm16 = new Int16Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, pcmFloat32Array[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  const pcmBuffer = Buffer.from(pcm16.buffer);
  return pcmToWavBuffer(pcmBuffer, sampleRate, 1, 16);
}

// API Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", engine: "gemini-3.1-flash-tts-preview" });
});

/**
 * Synthesizes speech using Google Cloud Text-to-Speech REST API (Neural2 / WaveNet PT-BR).
 * Includes 4 MILLION characters per month 100% FREE!
 */
async function synthesizeGoogleCloudTTS(
  text: string,
  voice: string,
  pacing: string = "normal"
): Promise<{ audioUrl: string; duration: number; voiceUsed: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("Chave de API do Gemini/Google Cloud não configurada no .env.");
  }

  let gcpVoice = "pt-BR-Neural2-A";
  if (voice === "Fenrir" || voice.includes("Neural2-B")) gcpVoice = "pt-BR-Neural2-B";
  else if (voice === "Zephyr" || voice.includes("Neural2-C")) gcpVoice = "pt-BR-Neural2-C";
  else if (voice === "Charon" || voice.includes("Wavenet-B")) gcpVoice = "pt-BR-Wavenet-B";
  else if (voice === "Puck" || voice.includes("Wavenet-C")) gcpVoice = "pt-BR-Wavenet-C";
  else if (voice === "Kore" || voice.includes("Neural2-A")) gcpVoice = "pt-BR-Neural2-A";

  let speakingRate = 1.0;
  if (pacing === "pausado") speakingRate = 0.88;
  else if (pacing === "rapido") speakingRate = 1.15;

  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text: text.trim() },
      voice: {
        languageCode: "pt-BR",
        name: gcpVoice,
      },
      audioConfig: {
        audioEncoding: "LINEAR16",
        speakingRate,
        sampleRateHertz: 24000,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.audioContent) {
    throw new Error(data.error?.message || "Google Cloud TTS indisponível.");
  }

  // Google Cloud TTS returns full LINEAR16 WAV base64
  const audioDataUrl = `data:audio/wav;base64,${data.audioContent}`;
  const pcmBuffer = Buffer.from(data.audioContent, "base64");
  const durationSeconds = +(pcmBuffer.length / (24000 * 2)).toFixed(1);

  return {
    audioUrl: audioDataUrl,
    duration: durationSeconds,
    voiceUsed: `${voice} (Google Cloud Neural2 PT-BR)`,
  };
}

let kokoroInstance: any = null;

/**
 * Synthesizes speech using Kokoro-82M ONNX model (hexgrad/Kokoro-82M)
 * Exclusively using Brazilian Portuguese official voices (pf_dora, pm_alex, pm_santa)
 */
async function synthesizeKokoro82M(
  text: string,
  voice = "pf_dora",
  pacing = "normal"
): Promise<{ audioUrl: string; duration: number; voiceUsed: string }> {
  if (!kokoroInstance) {
    console.log("⚡ Inicializando modelo Kokoro-82M ONNX (Vozes PT-BR)...");
    const kokoroModulePath = path.join(process.cwd(), "node_modules", "kokoro-js", "dist", "kokoro.js");
    const { KokoroTTS } = await import("file:///" + kokoroModulePath.replace(/\\/g, "/"));
    kokoroInstance = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
      dtype: "q8",
    });

    // Override voice validation to accept official Brazilian Portuguese Kokoro voices
    const origValidate = kokoroInstance._validate_voice.bind(kokoroInstance);
    kokoroInstance._validate_voice = function(voiceName: string) {
      if (["pf_dora", "pm_alex", "pm_santa"].includes(voiceName)) {
        return voiceName;
      }
      return origValidate(voiceName);
    };

    // Load local PT-BR voice binaries (.bin)
    const ptbrVoices = ["pf_dora", "pm_alex", "pm_santa"];
    for (const vId of ptbrVoices) {
      const binPath = path.join(process.cwd(), "node_modules", "kokoro-js", "voices", `${vId}.bin`);
      if (fs.existsSync(binPath)) {
        const buf = fs.readFileSync(binPath);
        const floatArr = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
        kokoroInstance.voices[vId] = floatArr;
      }
    }

    console.log("✅ Modelo Kokoro-82M pronto com as vozes oficiais PT-BR (Dora, Alex, Santa)!");
  }

  let speed = 1.0;
  if (pacing === "pausado") speed = 0.88;
  else if (pacing === "rapido") speed = 1.15;

  // Strict PT-BR Voice Selection
  let kokoroVoice = "pf_dora";
  if (voice === "pm_alex" || voice === "Alex" || voice === "Puck" || voice === "Charon") {
    kokoroVoice = "pm_alex";
  } else if (voice === "pm_santa" || voice === "Santa" || voice === "Fenrir") {
    kokoroVoice = "pm_santa";
  } else {
    kokoroVoice = "pf_dora"; // Default: Dora (pf_dora - PT-BR Female)
  }

  const audio = await kokoroInstance.generate(text.trim(), {
    voice: kokoroVoice,
    speed,
  });

  const wavArrayBuffer = audio.toWav();
  const wavBuffer = Buffer.from(wavArrayBuffer);
  const base64Wav = wavBuffer.toString("base64");
  const audioDataUrl = `data:audio/wav;base64,${base64Wav}`;

  const durationSeconds = +(wavBuffer.length / (24000 * 2)).toFixed(1);

  const voiceLabels: Record<string, string> = {
    pf_dora: "Dora (pf_dora - PT-BR)",
    pm_alex: "Alex (pm_alex - PT-BR)",
    pm_santa: "Santa (pm_santa - PT-BR)",
  };

  return {
    audioUrl: audioDataUrl,
    duration: durationSeconds,
    voiceUsed: `${voiceLabels[kokoroVoice] || kokoroVoice} (Kokoro-82M)`,
  };
}

let chatterboxClient: any = null;

/**
 * Synthesizes speech using Resemble AI Chatterbox Multilingual PT-BR model
 * Repo: ResembleAI/Chatterbox-Multilingual-pt-br
 * Space: ResembleAI/Chatterbox-Multilingual-TTS-pt-br
 */
async function synthesizeChatterboxPTBR(
  text: string,
  voice = "chatterbox_ptbr_f",
  pacing = "normal"
): Promise<{ audioUrl: string; duration: number; voiceUsed: string }> {
  const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN || process.env.HF_ACCESS_TOKEN;

  if (!chatterboxClient) {
    console.log("⚡ Conectando ao modelo Chatterbox Multilingual PT-BR (Resemble AI)...");
    const gradioPath = path.join(process.cwd(), "node_modules", "@gradio", "client", "dist", "index.js");
    const { Client } = await import("file:///" + gradioPath.replace(/\\/g, "/"));
    
    chatterboxClient = await Client.connect("ResembleAI/Chatterbox-Multilingual-TTS-pt-br", {
      hf_token: hfToken ? (hfToken.startsWith("hf_") ? hfToken : `hf_${hfToken}`) as any : undefined,
    });
    console.log("✅ Conectado ao Chatterbox Multilingual PT-BR com sucesso!");
  }

  const defaultRefAudio = chatterboxClient.config.components.find((c: any) => c.id === 5)?.props?.value;

  let speedMultiplier = 0.5; // default CFG/Pace
  if (pacing === "pausado") speedMultiplier = 0.4;
  else if (pacing === "rapido") speedMultiplier = 0.6;

  const result = await chatterboxClient.predict("/generate_tts_audio", [
    text.trim(),
    defaultRefAudio,
    0.5, // Exaggeration
    0.8, // Temperature
    0,   // Seed
    speedMultiplier, // CFG/Pace
  ]);

  const outputUrl = result.data?.[0]?.url;
  if (!outputUrl) {
    throw new Error("Resposta de áudio inválida do Chatterbox Multilingual PT-BR.");
  }

  const audioRes = await fetch(outputUrl);
  if (!audioRes.ok) {
    throw new Error(`Falha ao baixar áudio do Chatterbox: HTTP ${audioRes.status}`);
  }

  const audioBuf = await audioRes.arrayBuffer();
  const base64Wav = Buffer.from(audioBuf).toString("base64");
  const audioDataUrl = `data:audio/wav;base64,${base64Wav}`;
  const durationSeconds = +(audioBuf.byteLength / (24000 * 2)).toFixed(1);

  const voiceName = voice === "chatterbox_ptbr_m" ? "Resemble PT-BR Masculino" : "Resemble PT-BR Feminino";

  return {
    audioUrl: audioDataUrl,
    duration: durationSeconds,
    voiceUsed: `${voiceName} (Chatterbox Multilingual PT-BR)`,
  };
}

let razoSession: any = null;
let razoConfig: any = null;

/**
 * Synthesizes speech using Razo Piper ONNX model (Lucasllfs/Razo-piper-voice)
 * Ultra-fast local CPU inference in PT-BR (22.05kHz)
 */
async function synthesizeRazo(
  text: string,
  voice = "razo_ptbr_m",
  pacing = "normal"
): Promise<{ audioUrl: string; duration: number; voiceUsed: string }> {
  const modelsDir = path.join(process.cwd(), "models", "razo");
  const modelPath = path.join(modelsDir, "pt-BR-razo-medium.onnx");
  const configPath = path.join(modelsDir, "config.json");

  // Ensure model files are downloaded locally
  if (!fs.existsSync(modelPath) || !fs.existsSync(configPath)) {
    console.log("⚡ Baixando modelo Razo Piper ONNX de Lucasllfs/Razo-piper-voice...");
    fs.mkdirSync(modelsDir, { recursive: true });

    const cfgRes = await fetch("https://huggingface.co/Lucasllfs/Razo-piper-voice/raw/main/config.json");
    if (!cfgRes.ok) throw new Error("Falha ao baixar config.json do modelo Razo.");
    fs.writeFileSync(configPath, Buffer.from(await cfgRes.arrayBuffer()));

    const modelRes = await fetch("https://huggingface.co/Lucasllfs/Razo-piper-voice/resolve/main/pt-BR-razo-medium.onnx");
    if (!modelRes.ok) throw new Error("Falha ao baixar pt-BR-razo-medium.onnx do modelo Razo.");
    fs.writeFileSync(modelPath, Buffer.from(await modelRes.arrayBuffer()));
    console.log("✅ Modelo Razo Piper ONNX baixado com sucesso!");
  }

  if (!razoSession || !razoConfig) {
    console.log("⚡ Inicializando sessão ONNX do modelo Razo Piper...");
    const ort = appRequire("onnxruntime-node");
    razoConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    razoSession = await ort.InferenceSession.create(modelPath);
    console.log("✅ Modelo Razo Piper ONNX pronto para síntese local em CPU!");
  }

  const phonemeIdMap = razoConfig.phoneme_id_map || {};
  const sampleRate = razoConfig.audio?.sample_rate || 22050;

  // Convert text characters to Piper phoneme IDs
  const phonemeIds: number[] = [1]; // Start symbol ^
  for (const char of text.trim()) {
    const ids = phonemeIdMap[char] || phonemeIdMap[char.toLowerCase()] || phonemeIdMap[" "] || [3];
    for (const id of ids) {
      phonemeIds.push(id);
      phonemeIds.push(0); // Interspersed pad symbol _
    }
  }
  phonemeIds.push(0); // End symbol _

  let lengthScale = 1.0;
  if (pacing === "pausado") lengthScale = 1.18;
  else if (pacing === "rapido") lengthScale = 0.85;

  const ort = appRequire("onnxruntime-node");

  const inputTensor = new ort.Tensor("int64", BigInt64Array.from(phonemeIds.map(BigInt)), [1, phonemeIds.length]);
  const inputLengthsTensor = new ort.Tensor("int64", BigInt64Array.from([BigInt(phonemeIds.length)]), [1]);
  const scalesTensor = new ort.Tensor("float32", new Float32Array([0.667, lengthScale, 0.8]), [3]);

  const outputs = await razoSession.run({
    input: inputTensor,
    input_lengths: inputLengthsTensor,
    scales: scalesTensor,
  });

  const pcmFloat32Array = outputs.output.data;
  const wavBuffer = floatToPcmWavBuffer(pcmFloat32Array, sampleRate);
  const base64Wav = wavBuffer.toString("base64");
  const audioDataUrl = `data:audio/wav;base64,${base64Wav}`;
  const durationSeconds = +(wavBuffer.length / (sampleRate * 2)).toFixed(1);

  return {
    audioUrl: audioDataUrl,
    duration: durationSeconds,
    voiceUsed: "Razo (Piper TTS PT-BR)",
  };
}

// Single / Multi-speaker Narration Generator Endpoint
app.post("/api/tts/generate", async (req, res) => {
  try {
    const {
      text,
      voice = "Kore",
      style = "didatico",
      pacing = "normal",
      isMultiSpeaker = false,
      speaker1 = { name: "Instrutor", voice: "Kore" },
      speaker2 = { name: "Aluno", voice: "Puck" },
      engine = "gemini-flash",
    } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Texto da narração é necessário." });
    }

    // Explicit Razo Piper TTS PT-BR selection
    if (!isMultiSpeaker && engine === "razo-piper") {
      try {
        const razoResult = await synthesizeRazo(text, voice, pacing);
        return res.json({
          audioUrl: razoResult.audioUrl,
          duration: razoResult.duration,
          sampleRate: 22050,
          format: "wav",
          voiceUsed: razoResult.voiceUsed,
        });
      } catch (razoErr: any) {
        console.error("Razo Error:", razoErr);
        return res.status(500).json({ error: "Erro ao sintetizar áudio com Razo (Piper TTS): " + razoErr.message });
      }
    }

    // Explicit Chatterbox Multilingual PT-BR selection
    if (!isMultiSpeaker && engine === "chatterbox-ptbr") {
      try {
        const chatterResult = await synthesizeChatterboxPTBR(text, voice, pacing);
        return res.json({
          audioUrl: chatterResult.audioUrl,
          duration: chatterResult.duration,
          sampleRate: 24000,
          format: "wav",
          voiceUsed: chatterResult.voiceUsed,
        });
      } catch (chatterErr: any) {
        console.error("Chatterbox Error:", chatterErr);
        const errMsg = chatterErr.message || "";
        
        // Auto-fallback to local Razo / Kokoro when Hugging Face ZeroGPU quota is exceeded
        if (errMsg.includes("ZeroGPU quota") || errMsg.includes("exceeded your ZeroGPU")) {
          console.warn("⚠️ Cota ZeroGPU do Chatterbox excedida no Hugging Face. Executando fallback automático para o motor local Razo (Piper TTS PT-BR)...");
          try {
            const fallbackResult = await synthesizeRazo(text, voice, pacing);
            return res.json({
              audioUrl: fallbackResult.audioUrl,
              duration: fallbackResult.duration,
              sampleRate: 22050,
              format: "wav",
              voiceUsed: `${fallbackResult.voiceUsed} (Fallback automático por cota ZeroGPU)`,
            });
          } catch (fbErr: any) {
            console.error("Erro no fallback Razo:", fbErr);
          }
        }

        return res.status(429).json({ 
          error: "Cota de GPU gratuita do Chatterbox excedida no Hugging Face. Adicione seu HF_TOKEN no arquivo .env ou utilize o motor 'Razo (Piper TTS PT-BR)' ou 'Kokoro-82M', que rodam 100% offline em CPU local sem cotas!" 
        });
      }
    }

    // Explicit Kokoro-82M selection
    if (!isMultiSpeaker && engine === "kokoro-82m") {
      try {
        const kokoroResult = await synthesizeKokoro82M(text, voice, pacing);
        return res.json({
          audioUrl: kokoroResult.audioUrl,
          duration: kokoroResult.duration,
          sampleRate: 24000,
          format: "wav",
          voiceUsed: kokoroResult.voiceUsed,
        });
      } catch (kokoroErr: any) {
        console.error("Kokoro-82M Error:", kokoroErr);
        return res.status(500).json({ error: "Erro ao sintetizar áudio com Kokoro-82M: " + kokoroErr.message });
      }
    }

    // Explicit Google Cloud Text-to-Speech (Neural2 PT-BR) selection
    if (!isMultiSpeaker && engine === "cloud-neural2") {
      try {
        const cloudResult = await synthesizeGoogleCloudTTS(text, voice, pacing);
        return res.json({
          audioUrl: cloudResult.audioUrl,
          duration: cloudResult.duration,
          sampleRate: 24000,
          format: "wav",
          voiceUsed: cloudResult.voiceUsed,
        });
      } catch (gcpErr: any) {
        console.warn("Google Cloud TTS error, falling back to Gemini Flash TTS:", gcpErr.message);
      }
    }

    let pacingInstruction = "";
    if (pacing === "pausado") {
      pacingInstruction = " RITMO DA FALA: Mantenha ritmo pausado, sereno e reflexivo, com pausas respiratórias generosas entre frases.";
    } else if (pacing === "rapido") {
      pacingInstruction = " RITMO DA FALA: Mantenha ritmo ágil, dinâmico e direto ao ponto, com pausas breves.";
    } else if (pacing === "expressivo") {
      pacingInstruction = " RITMO DA FALA: Fale em cadência expressiva e variável, acelerando o ritmo em trechos empolgantes e desacelerando para dar ênfase a conceitos importantes.";
    } else {
      pacingInstruction = " RITMO DA FALA: Mantenha cadência equilibrada e fluxo natural de e-learning.";
    }

    let promptText = "";
    let config: any = {};

    if (isMultiSpeaker) {
      // Multi-speaker dialogue setup
      promptText = `Siga o roteiro de narração abaixo em Português do Brasil para um treinamento corporativo entre ${speaker1.name} e ${speaker2.name}.${pacingInstruction}\nMantenha dicção perfeita e ritmo ideal:\n\n${text}`;

      config = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: speaker1.name,
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: speaker1.voice },
                },
              },
              {
                speaker: speaker2.name,
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: speaker2.voice },
                },
              },
            ],
          },
        },
      };
    } else {
      // Single speaker narration with Brazilian Portuguese training tone guidance
      let toneInstruction = "Fale em tom didático, claro, com dicção cristalina em Português do Brasil.";
      if (style === "motivacional") {
        toneInstruction = "Fale em tom entusiasmado, motivacional, dinâmico e inspirador em Português do Brasil.";
      } else if (style === "tecnico") {
        toneInstruction = "Fale em tom técnico, preciso, seguro e firme, com pausas adequadas para assimilação em Português do Brasil.";
      } else if (style === "institucional") {
        toneInstruction = "Fale em tom institucional, elegante, acolhedor e profissional em Português do Brasil.";
      } else if (style === "calmo") {
        toneInstruction = "Fale em tom calmo, acolhedor, suave e reflexivo em Português do Brasil.";
      }

      promptText = `${toneInstruction}${pacingInstruction}
Narrar o seguinte texto de treinamento:
"${text.trim()}"`;

      config = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      };
    }

    // Call Gemini 3.1 Flash TTS Model
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: promptText }] }],
      config,
    });

    const candidate = response.candidates?.[0];
    const base64Pcm = candidate?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Pcm) {
      console.error("Gemini TTS Error - Empty inlineData:", JSON.stringify(response));
      return res.status(500).json({ error: "Não foi possível gerar o áudio da narração." });
    }

    // Convert PCM to WAV
    const pcmBuffer = Buffer.from(base64Pcm, "base64");
    const wavBuffer = pcmToWavBuffer(pcmBuffer, 24000);
    const wavBase64 = wavBuffer.toString("base64");
    const audioDataUrl = `data:audio/wav;base64,${wavBase64}`;

    // Calculate approximate duration in seconds (24000 samples/sec * 2 bytes/sample)
    const durationSeconds = +(pcmBuffer.length / (24000 * 2)).toFixed(1);

    return res.json({
      audioUrl: audioDataUrl,
      duration: durationSeconds,
      sampleRate: 24000,
      format: "wav",
      voiceUsed: isMultiSpeaker ? `${speaker1.voice} & ${speaker2.voice}` : voice,
    });
  } catch (err: any) {
    console.error("Error generating TTS:", err);
    let userErrorMessage = err.message || "Erro interno ao conectar com a API Gemini TTS.";
    if (userErrorMessage.includes("API key not valid") || userErrorMessage.includes("API_KEY_INVALID") || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY") {
      userErrorMessage = "Sua chave de API do Gemini (GEMINI_API_KEY) no arquivo .env é inválida ou ainda não foi configurada. Obtenha uma chave gratuita em https://aistudio.google.com/app/apikey e cole no arquivo .env.";
    } else if (userErrorMessage.includes("429") || userErrorMessage.includes("RESOURCE_EXHAUSTED") || userErrorMessage.includes("Quota exceeded") || userErrorMessage.includes("exceeded your current quota")) {
      userErrorMessage = "Limite temporário de cota do plano gratuito do Gemini atingido (10 requisições/minuto para síntese de voz). Aguarde 1 minuto (60 segundos) e tente novamente.";
    }
    return res.status(429).json({
      error: userErrorMessage,
    });
  }
});

// AI Script Optimizer Endpoint (using gemini-3.6-flash)
app.post("/api/script/optimize", async (req, res) => {
  try {
    const { rawText, targetTone = "didatico", mode = "narracao", includePacingNotes = true } = req.body;

    if (!rawText || typeof rawText !== "string") {
      return res.status(400).json({ error: "O texto original é necessário." });
    }

    let prompt = "";
    if (mode === "dialogo") {
      prompt = `Você é um roteirista especializado em treinamentos corporativos e e-learning no Brasil.
Transforme as notas/texto a seguir em um roteiro de DIÁLOGO ENTRE 2 PESSOAS (Instrutor e Aluno) ideal para narração em áudio.
Requisitos:
- Escreva em Português do Brasil natural, fluido e falado.
- Use a marcação "Instrutor:" para a primeira voz e "Aluno:" para a segunda voz.
- Torne as explicações claras e fáceis de entender.
- Mantenha frases curtas, sem termos excessivamente truncados.

Notas/Texto original:
"${rawText}"`;
    } else {
      prompt = `Você é um especialista em locução e narração para treinamentos corporativos em Português do Brasil.
Reescreva e otimize o texto a seguir para ser lido em voz alta em um treinamento com tom ${targetTone}.
Requisitos:
- Escreva em Português do Brasil natural, fluido e adaptado para a linguagem falada.
- Adicione marcações de pausa sutis como [pausa de 1s] onde for necessário dar tempo de assimilação ao aluno.
- Remova jargões visuais (ex: "como você vê nesta página") e substitua por linguagem focada em áudio.
- Garanta excelente cadência e clareza de pontuação.

Texto original:
"${rawText}"`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    const optimizedScript = response.text || rawText;

    return res.json({
      optimizedScript,
    });
  } catch (err: any) {
    console.error("Error optimizing script:", err);
    return res.status(500).json({ error: "Erro ao otimizar o roteiro de treinamento." });
  }
});

// Subtitles (SRT / VTT) Generator Endpoint
app.post("/api/script/generate-subtitles", async (req, res) => {
  try {
    const { text, durationSeconds } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Texto do roteiro é necessário." });
    }

    const prompt = `Crie legendas no formato VTT (WebVTT) para a seguinte narração de treinamento em Português do Brasil.
Duração total aproximada do áudio: ${durationSeconds || 30} segundos.
Divida em trechos curtos legíveis de no máximo 7 a 10 palavras por bloco.
Gere apenas o bloco de texto WebVTT válido começando com WEBVTT no topo.

Texto:
"${text}"`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    return res.json({
      vttContent: response.text || "",
    });
  } catch (err: any) {
    console.error("Error generating subtitles:", err);
    return res.status(500).json({ error: "Erro ao gerar legendas." });
  }
});

// Database API Endpoints (SQLite Persistence)

// GET History
app.get("/api/db/history", (req, res) => {
  try {
    const history = getHistory();
    return res.json(history);
  } catch (err: any) {
    return res.status(500).json({ error: "Erro ao buscar histórico no banco." });
  }
});

// POST History Item
app.post("/api/db/history", (req, res) => {
  try {
    const id = addHistoryItem(req.body);
    return res.json({ status: "ok", id });
  } catch (err: any) {
    console.error("Error adding history item:", err);
    return res.status(500).json({ error: "Erro ao salvar histórico no banco." });
  }
});

// DELETE Single History Item
app.delete("/api/db/history/:id", (req, res) => {
  try {
    deleteHistoryItem(req.params.id);
    return res.json({ status: "ok" });
  } catch (err: any) {
    return res.status(500).json({ error: "Erro ao remover item do histórico." });
  }
});

// DELETE All History
app.delete("/api/db/history", (req, res) => {
  try {
    clearHistory();
    return res.json({ status: "ok" });
  } catch (err: any) {
    return res.status(500).json({ error: "Erro ao limpar histórico no banco." });
  }
});

// GET Courses & Slides
app.get("/api/db/courses", (req, res) => {
  try {
    const courses = getCourses();
    return res.json(courses);
  } catch (err: any) {
    return res.status(500).json({ error: "Erro ao buscar cursos no banco." });
  }
});

// POST Save Course & Slides
app.post("/api/db/courses", (req, res) => {
  try {
    saveCourse(req.body);
    return res.json({ status: "ok" });
  } catch (err: any) {
    console.error("Error saving course:", err);
    return res.status(500).json({ error: "Erro ao salvar curso no banco." });
  }
});

// DELETE Course
app.delete("/api/db/courses/:id", (req, res) => {
  try {
    deleteCourse(req.params.id);
    return res.json({ status: "ok" });
  } catch (err: any) {
    return res.status(500).json({ error: "Erro ao excluir curso no banco." });
  }
});

// Setup Vite development server or production static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
