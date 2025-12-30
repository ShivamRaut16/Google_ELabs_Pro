
import React, { useEffect, useRef, useState } from 'react';

interface MiniWaveformProps {
  stream: MediaStream | null;
  isActive: boolean;
}

const MiniWaveform: React.FC<MiniWaveformProps> = ({ stream, isActive }) => {
  const [levels, setLevels] = useState([0, 0, 0]);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!isActive || !stream) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      return;
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 32;
    source.connect(analyzer);
    analyzerRef.current = analyzer;

    const dataArray = new Uint8Array(analyzer.frequencyBinCount);

    const update = () => {
      if (!analyzerRef.current) return;
      analyzerRef.current.getByteFrequencyData(dataArray);
      
      // Get three frequency bands
      const b1 = dataArray[1] / 255;
      const b2 = dataArray[4] / 255;
      const b3 = dataArray[8] / 255;
      
      setLevels([b1, b2, b3]);
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
    <div className="flex items-center gap-0.5 h-3 w-4">
      {levels.map((lvl, i) => (
        <div 
          key={i}
          className="w-1 bg-rose-500 rounded-full transition-all duration-75 ease-out"
          style={{ height: `${20 + lvl * 80}%` }}
        />
      ))}
    </div>
  );
};

export default MiniWaveform;
