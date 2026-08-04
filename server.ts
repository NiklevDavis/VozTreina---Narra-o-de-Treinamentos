import express from "express";
import path from "path";
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
