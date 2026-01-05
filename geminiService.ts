
import { GoogleGenAI, Type } from "@google/genai";
import { VoiceCommandResponse } from "../types";

const API_KEY = process.env.API_KEY || "";

export const parseVoiceCommand = async (text: string, lang: 'zh' | 'en'): Promise<VoiceCommandResponse> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const prompt = `Analyze the following construction site voice command: "${text}". 
  Categorize it into one of: add_expense, add_note, add_project.
  Extract relevant data: amount (number), description (string), text (string), name (string), phone (string).
  Provide a friendly feedback message in ${lang === 'zh' ? 'Chinese' : 'English'}.
  Respond in JSON format.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING },
            data: {
              type: Type.OBJECT,
              properties: {
                amount: { type: Type.NUMBER },
                description: { type: Type.STRING },
                text: { type: Type.STRING },
                name: { type: Type.STRING },
                phone: { type: Type.STRING }
              }
            },
            feedback: { type: Type.STRING }
          },
          required: ["action", "feedback"]
        }
      }
    });

    return JSON.parse(response.text || "{}") as VoiceCommandResponse;
  } catch (error) {
    console.error("Gemini parse error:", error);
    return {
      action: 'unknown',
      data: {},
      feedback: lang === 'zh' ? "抱歉，我没听清，请再说一遍。" : "Sorry, I didn't catch that. Could you repeat?"
    };
  }
};

export const generateSpeech = async (text: string) => {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: ["AUDIO" as any],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' }
                    }
                }
            }
        });
        
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const buffer = await decodeAudioData(audioData, ctx, 24000, 1);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.start();
        }
    } catch (e) {
        console.error("TTS failed", e);
    }
}

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}
