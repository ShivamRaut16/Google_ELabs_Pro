
export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export interface TranslationResult {
  detected_language: string;
  translation: {
    translated_text: string;
    alternate_meanings: string[];
    ambiguity_detected: boolean;
  };
  evaluation: {
    confidence_score: number;
    risk_level: RiskLevel;
    risk_reason: string;
    potential_harm: string;
  };
  safety: {
    should_warn_user: boolean;
    safety_message: string;
  };
  voice_policy: {
    voice_language: string;
    voice_tone: string;
    speaking_speed: 'slow' | 'normal' | 'fast';
    emphasis: 'low' | 'medium' | 'high';
  };
}

export interface SessionHistoryItem {
  id: string;
  timestamp: Date;
  userInput: string;
  result: TranslationResult;
}

export const TARGET_LANGUAGES = [
  "English", "French", "German", "Spanish", "Hindi", "Marathi", "Gujarati", "Japanese", "Chinese"
];
