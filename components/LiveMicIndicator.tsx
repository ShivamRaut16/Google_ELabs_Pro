
import React, { useEffect, useRef, useState } from 'react';

interface LiveMicIndicatorProps {
  stream: MediaStream | null;
  isActive: boolean;
}

const LiveMicIndicator: React.FC<LiveMicIndicatorProps> = ({ stream, isActive }) => {
  const [frequencyData, setFrequencyData] = useState<number[]>(new Array(7).fill(0));
  const [peak, setPeak] = useState(0);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!isActive || !stream) {
      setFrequencyData(new Array(7).fill(0));
      setPeak(0);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      return;
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const analyzer = audioContext.createAnalyser();
    // Larger FFT size for better frequency resolution
    analyzer.fftSize = 256; 
    analyzer.smoothingTimeConstant = 0.6; // Smoother transitions
    source.connect(analyzer);
    analyzerRef.current = analyzer;

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const update = () => {
      if (!analyzerRef.current) return;
      analyzerRef.current.getByteFrequencyData(dataArray);
      
      // Map frequency bins to our 7 UI bars
      // We focus on lower-to-mid frequencies where speech lives (roughly indices 0-60)
      const barCount = 7;
      const step = Math.floor(60 / barCount);
      const newFrequencies = [];
      let currentMax = 0;

      for (let i = 0; i < barCount; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += dataArray[i * step + j];
        }
        const val = sum / step / 255;
        newFrequencies.push(val);
        if (val > currentMax) currentMax = val;
      }

      setFrequencyData(newFrequencies);
      setPeak(currentMax);
      
      animationFrameRef.current = requestAnimationFrame(update);
    };

    update();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [stream, isActive]);

  if (!isActive) return null;

  return (
    <>
      {/* Primary Dynamic Glow - Responds to overall peak volume */}
      <div 
        className="absolute inset-0 rounded-full transition-all duration-75 pointer-events-none z-0"
        style={{ 
          boxShadow: `0 0 ${40 + peak * 100}px rgba(225, 29, 72, ${0.1 + peak * 0.6}), 0 0 ${20 + peak * 60}px rgba(99, 102, 241, ${0.1 + peak * 0.4})`,
          transform: `scale(${1 + peak * 0.25})`,
          opacity: 0.5 + peak * 0.5
        }}
      />
      
      {/* Floating Orbital Glow - Reacts to energy */}
      <div 
        className="absolute inset-0 rounded-full border border-rose-500/30 blur-md transition-all duration-100 ease-out"
        style={{ 
          transform: `scale(${1.1 + peak * 0.5}) rotate(${peak * 45}deg)`, 
          opacity: 0.1 + peak * 0.6 
        }}
      />
      
      {/* Responsive Spectrum Waveform at bottom */}
      <div className="absolute -bottom-16 flex items-end gap-2 h-14">
        {frequencyData.map((val, i) => (
          <div 
            key={i}
            className="w-2 bg-gradient-to-t from-rose-600 via-rose-400 to-indigo-400 rounded-full transition-all duration-100 ease-out"
            style={{ 
              height: `${10 + val * 90}%`,
              opacity: 0.3 + val * 0.7,
              boxShadow: val > 0.7 ? `0 0 10px rgba(225, 29, 72, ${val})` : 'none'
            }}
          />
        ))}
      </div>
    </>
  );
};

export default LiveMicIndicator;
