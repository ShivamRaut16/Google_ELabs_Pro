
import React, { useEffect, useRef, useState } from 'react';

interface LiveMicIndicatorProps {
  stream: MediaStream | null;
  isActive: boolean;
}

const LiveMicIndicator: React.FC<LiveMicIndicatorProps> = ({ stream, isActive }) => {
  const [volume, setVolume] = useState(0);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!isActive || !stream) {
      setVolume(0);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      return;
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 64; 
    source.connect(analyzer);
    analyzerRef.current = analyzer;

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateVolume = () => {
      if (!analyzerRef.current) return;
      analyzerRef.current.getByteFrequencyData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const normalizedVolume = Math.min(1, average / 128);
      setVolume(normalizedVolume);
      
      animationFrameRef.current = requestAnimationFrame(updateVolume);
    };

    updateVolume();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [stream, isActive]);

  if (!isActive) return null;

  return (
    <>
      {/* Primary Dynamic Glow */}
      <div 
        className="absolute inset-0 rounded-full transition-all duration-75 pointer-events-none z-0"
        style={{ 
          boxShadow: `0 0 ${30 + volume * 80}px rgba(225, 29, 72, ${0.2 + volume * 0.5}), 0 0 ${15 + volume * 40}px rgba(99, 102, 241, ${0.1 + volume * 0.3})`,
          transform: `scale(${1 + volume * 0.2})`,
          opacity: 0.6 + volume * 0.4
        }}
      />
      
      {/* Floating Orbital Glows */}
      <div 
        className="absolute inset-0 rounded-full border border-rose-500/20 blur-sm transition-all duration-100 ease-out"
        style={{ transform: `scale(${1.2 + volume * 0.4})`, opacity: volume * 0.5 }}
      />
      
      {/* Responsive Waveform indicator at bottom */}
      <div className="absolute -bottom-14 flex items-end gap-1.5 h-10">
        {[...Array(7)].map((_, i) => (
          <div 
            key={i}
            className="w-1.5 bg-gradient-to-t from-rose-600 to-rose-400 rounded-full transition-all duration-75"
            style={{ 
              height: `${15 + (Math.sin(Date.now() / 200 + i) * 10) + (volume * 85 * (1 - Math.abs(i-3)/4))}%`,
              opacity: 0.2 + volume * 0.8
            }}
          />
        ))}
      </div>
    </>
  );
};

export default LiveMicIndicator;
