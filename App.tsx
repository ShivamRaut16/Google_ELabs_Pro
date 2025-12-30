
import React, { useState, useEffect, useRef } from 'react';
import { gemini } from './services/geminiService';
import { TranslationResult, TARGET_LANGUAGES, SessionHistoryItem, RiskLevel } from './types';
import RiskBadge from './components/RiskBadge';
import SafetyWarning from './components/SafetyWarning';
import SettingsPanel from './components/SettingsPanel';

const App: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetLang, setTargetLang] = useState('English');
  const [history, setHistory] = useState<SessionHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [sensitivity, setSensitivity] = useState(50);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const startRecording = async () => {
    setError(null);
    audioChunksRef.current = [];
    
    try {
      const constraints = {
        audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Create an internal audio graph to apply gain (sensitivity)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const gainNode = audioContext.createGain();
      
      // Sensitivity 50 is gain 1.0. 100 is gain 2.0. 0 is gain 0.0.
      gainNode.gain.value = (sensitivity / 50);
      
      const destination = audioContext.createMediaStreamDestination();
      source.connect(gainNode);
      gainNode.connect(destination);

      const recorder = new MediaRecorder(destination.stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleAudioProcess(audioBlob);
        audioContext.close();
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Recording error:", err);
      setError("Failed to access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
  };

  const handleAudioProcess = async (blob: Blob) => {
    setIsProcessing(true);
    setError(null);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        const result = await gemini.processAudioInput(base64Audio, blob.type, targetLang);
        
        const newItem: SessionHistoryItem = {
          id: Math.random().toString(36).substring(7),
          timestamp: new Date(),
          userInput: `[Audio Analysis - ${result.detected_language}]`,
          result
        };

        setHistory(prev => [newItem, ...prev]);
        await handleSpeak(result);
        setIsProcessing(false);
      };
    } catch (err: any) {
      console.error(err);
      setError("Analysis failed. Please try again.");
      setIsProcessing(false);
    }
  };

  const handleSpeak = async (result: TranslationResult) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const audioBufferData = await gemini.speak(result.translation.translated_text, result.voice_policy);
      
      const decodeRawPCM = async (data: Uint8Array, ctx: AudioContext) => {
        const dataInt16 = new Int16Array(data.buffer);
        const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < dataInt16.length; i++) {
          channelData[i] = dataInt16[i] / 32768.0;
        }
        return buffer;
      };

      const buffer = await decodeRawPCM(new Uint8Array(audioBufferData), audioContextRef.current);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.start();
    } catch (e) {
      console.error("Speech playback error:", e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-200">
      <header className="glass-panel sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <i className="fas fa-shield-halved text-white text-xl"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">SentinelVoice <span className="text-indigo-400 text-sm">AI</span></h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Responsible Translation Bridge</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <select 
            value={targetLang} 
            onChange={(e) => setTargetLang(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 outline-none cursor-pointer"
          >
            {TARGET_LANGUAGES.map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-indigo-400 transition-all"
            title="Configure Microphone"
          >
            <i className="fas fa-sliders text-lg"></i>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
        <section className="glass-panel rounded-3xl p-8 text-center flex flex-col items-center gap-6 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-30"></div>
          
          <div className="flex flex-col items-center">
            <h2 className="text-2xl font-light mb-2">Safe Multilingual Communication</h2>
            <p className="text-slate-400 text-sm max-w-md">Press and hold the microphone to record your message.</p>
          </div>

          <div className="relative group flex items-center justify-center h-48 w-48">
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={() => isRecording && stopRecording()}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              disabled={isProcessing}
              className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
                isRecording 
                ? 'bg-rose-600 scale-110 shadow-[0_0_30px_rgba(225,29,72,0.6)]' 
                : 'bg-indigo-600 hover:bg-indigo-500 hover:scale-105 shadow-indigo-600/40'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
            >
              {isProcessing ? (
                <i className="fas fa-spinner fa-spin text-5xl"></i>
              ) : isRecording ? (
                <div className="flex items-center gap-1 h-8">
                  <div className="w-1 bg-white h-full animate-[bounce_0.6s_infinite] [animation-delay:-0.4s]"></div>
                  <div className="w-1 bg-white h-3/4 animate-[bounce_0.6s_infinite] [animation-delay:-0.2s]"></div>
                  <div className="w-1 bg-white h-full animate-[bounce_0.6s_infinite]"></div>
                  <div className="w-1 bg-white h-3/4 animate-[bounce_0.6s_infinite] [animation-delay:-0.2s]"></div>
                  <div className="w-1 bg-white h-full animate-[bounce_0.6s_infinite] [animation-delay:-0.4s]"></div>
                </div>
              ) : (
                <i className="fas fa-microphone text-5xl"></i>
              )}
            </button>
            
            {/* Visual ripple effect when recording */}
            {isRecording && (
              <>
                <div className="absolute inset-0 w-full h-full rounded-full border-2 border-rose-500/40 pulse-ring animate-[pulse_1.5s_linear_infinite]"></div>
                <div className="absolute inset-0 w-full h-full rounded-full border-2 border-rose-500/30 pulse-ring animate-[pulse_2s_linear_infinite_0.5s]"></div>
                <div className="absolute inset-0 w-full h-full rounded-full border-2 border-rose-500/20 pulse-ring animate-[pulse_2.5s_linear_infinite_1s]"></div>
              </>
            )}
          </div>

          <div className="w-full max-w-lg min-h-[2.5rem] flex flex-col items-center justify-center">
            {isRecording && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                <p className="text-rose-400 text-sm font-bold tracking-widest uppercase">Recording Active</p>
              </div>
            )}
            {isProcessing && <p className="text-indigo-400 text-sm font-medium">Analyzing emotion, context & safety...</p>}
            {error && <p className="text-rose-400 text-xs mt-2 font-medium bg-rose-500/10 p-2 px-4 rounded-lg border border-rose-500/20">{error}</p>}
          </div>
        </section>

        <section className="flex flex-col gap-4 mb-20">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <i className="fas fa-history text-slate-500"></i>
              Session Insights
            </h3>
            <span className="text-xs text-slate-500 uppercase tracking-widest font-mono">{history.length} RECORDS</span>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-24 opacity-20 select-none grayscale">
              <i className="fas fa-wave-square text-8xl mb-4"></i>
              <p className="text-xl">Your conversation history will appear here.</p>
            </div>
          ) : (
            history.map((item) => (
              <div key={item.id} className="glass-panel rounded-2xl p-6 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 hover:border-slate-600 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
                      <i className="fas fa-earth-americas"></i>
                      {item.result.detected_language} ➞ {targetLang}
                    </span>
                    <p className="text-slate-200 font-medium italic opacity-70">"{item.userInput}"</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <RiskBadge level={item.result.evaluation.risk_level} />
                    <span className="text-[10px] text-slate-500 font-mono">
                      {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                </div>

                <div className="h-px bg-slate-800"></div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <i className="fas fa-language"></i>
                      Translation
                    </h4>
                    <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-inner">
                      <p className="text-xl text-indigo-300 font-semibold leading-relaxed">{item.result.translation.translated_text}</p>
                      {item.result.translation.alternate_meanings.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-800/50">
                          <p className="text-[10px] text-slate-500 font-bold uppercase mb-2 tracking-wide">Contextual Options</p>
                          <ul className="text-xs text-slate-400 space-y-1">
                            {item.result.translation.alternate_meanings.map((m, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-indigo-500">•</span>
                                {m}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <i className="fas fa-magnifying-glass-chart"></i>
                      Analysis
                    </h4>
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-bold uppercase tracking-tighter">Certainty</span>
                          <span className="font-mono text-indigo-400 font-bold">{item.result.evaluation.confidence_score}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2">
                          <div 
                            className="bg-indigo-500 h-2 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(99,102,241,0.5)]" 
                            style={{ width: `${item.result.evaluation.confidence_score}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800/50">
                        <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">Reasoning</p>
                        <p className="text-xs text-slate-300 leading-relaxed italic">
                          "{item.result.evaluation.risk_reason}"
                        </p>
                        {item.result.evaluation.risk_level === RiskLevel.HIGH && (
                          <div className="mt-2 pt-2 border-t border-slate-800/50 flex items-start gap-2">
                            <i className="fas fa-triangle-exclamation text-rose-500 text-[10px] mt-1"></i>
                            <p className="text-[10px] text-rose-400 font-medium">
                              {item.result.evaluation.potential_harm}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {item.result.safety.should_warn_user && (
                  <SafetyWarning 
                    message={item.result.safety.safety_message} 
                    level={item.result.evaluation.risk_level} 
                  />
                )}

                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-800/20">
                  <div className="flex items-center gap-4 text-[10px] text-slate-500 uppercase font-bold tracking-tighter">
                    <span className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded">
                      <i className="fas fa-volume-high text-indigo-500"></i>
                      {item.result.voice_policy.voice_tone}
                    </span>
                    <span className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded">
                      <i className="fas fa-gauge-high text-emerald-500"></i>
                      {item.result.voice_policy.speaking_speed}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleSpeak(item.result)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 rounded-xl text-xs font-bold text-indigo-400 transition-all hover:scale-105 active:scale-95"
                  >
                    <i className="fas fa-play"></i>
                    Replay Audio
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      </main>

      <SettingsPanel 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        selectedDeviceId={selectedDeviceId}
        onDeviceChange={setSelectedDeviceId}
        sensitivity={sensitivity}
        onSensitivityChange={setSensitivity}
      />

      <footer className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 py-3 px-6 flex justify-between items-center z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-5 text-[10px] text-slate-500 tracking-wider font-bold">
          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/5 rounded">
            <i className="fas fa-brain text-indigo-500 opacity-80"></i> GEMINI 3 FLASH
          </span>
          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/5 rounded">
            <i className="fas fa-microphone-lines text-emerald-500 opacity-80"></i> {selectedDeviceId ? 'DEVICE CUSTOM' : 'DEFAULT'}
          </span>
        </div>
        <div className="text-[10px] text-slate-500 font-mono opacity-60">
          SENTINELVOICE-PRO-v1.0
        </div>
      </footer>
    </div>
  );
};

export default App;
