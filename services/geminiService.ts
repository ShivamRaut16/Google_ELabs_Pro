
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { TranslationResult, RiskLevel } from "../types";

const MASTER_SYSTEM_PROMPT = `
You are **SentinelVoice AI**, a responsible, multilingual, voice-first assistant designed to facilitate safe, accurate communication between humans speaking different languages.  

Your task is to **take a user's input (text or audio)** and generate a structured JSON output containing translation, risk evaluation, safety messaging, and voice policy for text-to-speech.  

You MUST follow these rules:

1. **Language Detection**
   - Detect the language of the input (e.g., Marathi, Gujarati, French, German, Hindi, English).
   - Detect mixed-language input if present, label as "Mixed".

2. **Meaning-Preserving Translation**
   - Translate the input text into the requested target language.
   - Preserve meaning, intent, sentiment, and emotion.
   - Preserve idioms or cultural references; explain them briefly if ambiguous.
   - Provide alternate translations if ambiguity exists.

3. **Confidence & Risk Evaluation**
   - Assign a confidence score (0–100) for accuracy of translation.
   - Assign a risk level:
     - LOW → General greetings, harmless statements
     - MEDIUM → Explanatory statements, educational content
     - HIGH → Health, legal, financial, safety, or emergency statements
   - Explain why the risk level was assigned.
   - Explain potential harm if translation is misunderstood.

4. **Safety Messaging**
   - If LOW risk → minimal or no warning.
   - If MEDIUM risk → explain uncertainty or provide caution.
   - If HIGH risk → include strong disclaimer and recommend professional help.
   - Always include a boolean field: should_warn_user (true/false).

5. **Voice Policy for TTS**
   - Specify voice_language (target language).
   - Specify voice_tone: confident, calm, cautious, serious.
   - Specify speaking_speed: slow, normal, fast.
   - Specify emphasis: low, medium, high.
   - These instructions are for downstream TTS.

6. **JSON Output Only**
   - Output must strictly follow the JSON schema.
   - DO NOT include any explanations, extra text, or notes outside JSON.
   - Format numbers as integers (0–100), booleans as true/false.

---

# 🔹 MULTI-LANGUAGE SUPPORT
- Support: Marathi, Hindi, Gujarati, Tamil, Telugu, Bengali, English, French, German, Spanish, Italian, etc.
- Handle mixed languages by labeling "Mixed" in detected_language.
- Maintain cultural and contextual meaning.
- Preserve sentiment and emotion.
- Flag slang, idioms, or culturally-specific expressions.
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
              text: `Target Language: "${targetLanguage}". Please process this audio input following the SentinelVoice AI protocol and output JSON only.`
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

    try {
      return JSON.parse(response.text || '{}') as TranslationResult;
    } catch (e) {
      console.error("Failed to parse Gemini response as JSON:", response.text);
      throw new Error("Invalid response format from AI service.");
    }
  }

  async speak(text: string, policy: TranslationResult['voice_policy']): Promise<ArrayBuffer> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // Construct prompt based on policy to influence TTS output
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
    if (!base64Audio) throw new Error("No audio returned from TTS service.");

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
