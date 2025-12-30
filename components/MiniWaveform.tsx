
import React, { useEffect, useRef, useState } from 'react';

interface MiniWaveformProps {
  stream: MediaStream | null;
  isActive: boolean;
}

const MiniWaveform: React.FC<MiniWaveformProps> = ({ stream, isActive }) => {
  const [levels, setLevels] = useState([0, 0, 0, 0, 0]);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!isActive || !stream) {
      setLevels([0, 0, 0, 0, 0]);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      return;
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const analyzer = audioContext.createAnalyser();
    // Using a size that balances precision and performance for mini display
    analyzer.fftSize = 128;
    analyzer.smoothingTimeConstant = 0.5;
    source.connect(analyzer);
    analyzerRef.current = analyzer;

    const dataArray = new Uint8Array(analyzer.frequencyBinCount);

    const update = () => {
      if (!analyzerRef.current) return;
      analyzerRef.current.getByteFrequencyData(dataArray);
      
      // Select 5 strategic frequency indices to represent the spectrum
      // Speech typically ranges from 100Hz to 4kHz.
      // Indices: 2 (Sub), 6 (Bass), 14 (Mids), 28 (High-Mids), 48 (Highs)
      const b1 = dataArray[2] / 255;
      const b2 = dataArray[6] / 255;
      const b3 = dataArray[14] / 255;
      const b4 = dataArray[28] / 255;
      const b5 = dataArray[48] / 255;
      
      setLevels([b1, b2, b3, b4, b5]);
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
    <div className="flex items-center gap-0.5 h-3.5 w-6">
      {levels.map((lvl, i) => (
        <div 
          key={i}
          className="w-1 bg-rose-500 rounded-full transition-all duration-100 ease-out"
          style={{ 
            height: `${20 + lvl * 80}%`,
            opacity: 0.4 + lvl * 0.6
          }}
        />
      ))}
    </div>
  );
};

export default MiniWaveform;
