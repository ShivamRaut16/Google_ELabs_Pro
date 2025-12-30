
import React, { useEffect, useRef, useState } from 'react';

interface VolumeMeterProps {
  stream: MediaStream | null;
  sensitivity: number;
  onClip?: (clipping: boolean) => void;
}

const VolumeMeter: React.FC<VolumeMeterProps> = ({ stream, sensitivity, onClip }) => {
  const [level, setLevel] = useState(0);
  const requestRef = useRef<number>(null);
  const analyzerRef = useRef<AnalyserNode>(null);
  const audioContextRef = useRef<AudioContext>(null);
  const clippingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!stream) {
      setLevel(0);
      if (onClip) onClip(false);
      return;
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    (audioContextRef as any).current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 256;
    source.connect(analyzer);
    (analyzerRef as any).current = analyzer;

    const update = () => {
      if (!analyzerRef.current) return;
      const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
      analyzerRef.current.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      // Calculate raw level before clamping to detect clipping
      const rawLevel = (average / 128) * 100 * (sensitivity / 50);
      const normalizedLevel = Math.min(100, rawLevel);
      
      setLevel(normalizedLevel);

      const isClipping = rawLevel >= 100;
      if (isClipping !== clippingRef.current) {
        clippingRef.current = isClipping;
        if (onClip) onClip(isClipping);
      }
      
      (requestRef as any).current = requestAnimationFrame(update);
    };

    update();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [stream, sensitivity, onClip]);

  return (
    <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner">
      <div 
        className={`h-full bg-gradient-to-r from-indigo-500 via-emerald-500 to-rose-500 transition-all duration-75 ease-out ${level >= 100 ? 'animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.6)]' : ''}`}
        style={{ width: `${level}%` }}
      ></div>
    </div>
  );
};

export default VolumeMeter;
