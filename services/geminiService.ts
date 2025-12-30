
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { TranslationResult, RiskLevel } from "../types";

const MASTER_SYSTEM_PROMPT = `
You are SentinelVoice AI, a responsible, multilingual, voice-first assistant designed to enable safe and accurate communication across languages. 

Your responsibilities:
1. Detect the input language and dialect (if mixed, specify "Mixed").
2. Translate the message into the requested target language while preserving:
   - Meaning
   - Emotion
   - Cultural nuance
   - Idioms
3. Evaluate confidence and potential risk:
   - Confidence score (0–100)
   - Risk level: LOW | MEDIUM | HIGH
   - Risk explanation
   - Potential harm if misunderstood
4. Provide a safety message appropriate to the risk:
   - LOW → minimal explanation
   - MEDIUM → explain uncertainty
   - HIGH → strong caution and recommend professional help
5. Decide how the output should be spoken in natural voice:
   - Voice language
   - Tone: confident | calm | cautious | serious
   - Speaking speed: slow | normal | fast
   - Emphasis: low | medium | high
6. Output must be structured in JSON only, strictly following the schema below. Do not add any extra text or explanations outside the JSON.

---

# 🔹 JSON OUTPUT SCHEMA

{
  "detected_language": "",
  "translation": {
    "translated_text": "",
    "alternate_meanings": [],
    "ambiguity_detected": false
  },
  "evaluation": {
    "confidence_score": 0,
    "risk_level": "LOW | MEDIUM | HIGH",
    "risk_reason": "",
    "potential_harm": ""
  },
  "safety": {
    "should_warn_user": false,
    "safety_message": ""
  },
  "voice_policy": {
    "voice_language": "",
    "voice_tone": "",
    "speaking_speed": "",
    "emphasis": ""
  }
}

---

# 🔹 INPUT INSTRUCTIONS

- Input: User’s spoken text or audio content
- Target language: User-selected or default
- Output should consider:
   - Mixed languages
   - Slang or idiomatic expressions
   - Emotion or sentiment
   - High-risk contexts (health, legal, finance, emergency)
- Translate meaningfully, not literally
- Clearly identify uncertainty and ambiguity
- Adjust tone based on risk level
- Always output JSON exactly as specified.
- Never provide professional advice; always include disclaimers for HIGH-risk content.
`;

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async processAudioInput(audioBase64: string, mimeType: string, targetLanguage: string): Promise<TranslationResult> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: audioBase64,
                mimeType: mimeType
              }
            },
            {
              text: `Target Language: "${targetLanguage}". Please process this audio following the SentinelVoice AI protocol.`
            }
          ]
        }
      ],
      config: {
        systemInstruction: MASTER_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detected_language: { type: Type.STRING },
            translation: {
              type: Type.OBJECT,
              properties: {
                translated_text: { type: Type.STRING },
                alternate_meanings: { type: Type.ARRAY, items: { type: Type.STRING } },
                ambiguity_detected: { type: Type.BOOLEAN }
              },
              required: ["translated_text", "alternate_meanings", "ambiguity_detected"]
            },
            evaluation: {
              type: Type.OBJECT,
              properties: {
                confidence_score: { type: Type.NUMBER },
                risk_level: { type: Type.STRING, enum: Object.values(RiskLevel) },
                risk_reason: { type: Type.STRING },
                potential_harm: { type: Type.STRING }
              },
              required: ["confidence_score", "risk_level", "risk_reason", "potential_harm"]
            },
            safety: {
              type: Type.OBJECT,
              properties: {
                should_warn_user: { type: Type.BOOLEAN },
                safety_message: { type: Type.STRING }
              },
              required: ["should_warn_user", "safety_message"]
            },
            voice_policy: {
              type: Type.OBJECT,
              properties: {
                voice_language: { type: Type.STRING },
                voice_tone: { type: Type.STRING },
                speaking_speed: { type: Type.STRING },
                emphasis: { type: Type.STRING }
              },
              required: ["voice_language", "voice_tone", "speaking_speed", "emphasis"]
            }
          },
          required: ["detected_language", "translation", "evaluation", "safety", "voice_policy"]
        }
      }
    });

    return JSON.parse(response.text || '{}') as TranslationResult;
  }

  async speak(text: string, policy: TranslationResult['voice_policy']): Promise<ArrayBuffer> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Say in ${policy.voice_language} with a ${policy.voice_tone} tone and ${policy.speaking_speed} speed: ${text}`;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio returned");

    return this.decodeBase64(base64Audio);
  }

  private decodeBase64(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export const gemini = new GeminiService();
