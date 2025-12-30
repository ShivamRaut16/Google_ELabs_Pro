
import React, { useEffect, useState, useCallback } from 'react';
import VolumeMeter from './VolumeMeter';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDeviceId: string;
  onDeviceChange: (id: string) => void;
  sensitivity: number;
  onSensitivityChange: (val: number) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  isOpen, 
  onClose, 
  selectedDeviceId, 
  onDeviceChange,
  sensitivity,
  onSensitivityChange
}) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isClipping, setIsClipping] = useState(false);

  const refreshDevices = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const devList = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devList.filter(d => d.kind === 'audioinput');
      setDevices(audioInputs);
      
      if (audioInputs.length > 0 && !selectedDeviceId) {
        const defaultDevice = audioInputs.find(d => d.deviceId === 'default') || audioInputs[0];
        onDeviceChange(defaultDevice.deviceId);
      }
    } catch (err) {
      console.error("Error accessing media devices.", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshDevices();
      navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
    }
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
    };
  }, [isOpen]);

  useEffect(() => {
    const updatePreviewStream = async () => {
      if (!isOpen) {
        if (stream) stream.getTracks().forEach(t => t.stop());
        setStream(null);
        return;
      }

      try {
        if (stream) stream.getTracks().forEach(t => t.stop());
        const constraints = { 
          audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true 
        };
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(newStream);
      } catch (err) {
        console.error("Error updating preview stream", err);
      }
    };

    updatePreviewStream();
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [selectedDeviceId, isOpen]);

  const handleClip = useCallback((clipping: boolean) => {
    setIsClipping(clipping);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}></div>
      <div className="relative w-full max-w-sm h-full glass-panel border-l border-slate-700 shadow-2xl p-6 flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <i className="fas fa-sliders text-indigo-400"></i>
            Audio Settings
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="flex-1 space-y-8">
          {/* Mic Selection */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <i className="fas fa-microphone-lines"></i>
              Microphone Device
            </label>
            <div className="relative">
              <select
                value={selectedDeviceId}
                onChange={(e) => onDeviceChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl p-3 pl-4 text-sm outline-none appearance-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
              >
                {devices.length === 0 ? (
                  <option value="">No Microphones Found</option>
                ) : (
                  devices.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microphone ${device.deviceId.slice(0, 8)}...`}
                    </option>
                  ))
                )}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">
                <i className="fas fa-chevron-down text-xs"></i>
              </div>
            </div>
          </div>

          {/* Sensitivity */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <i className="fas fa-wave-square"></i>
                Input Sensitivity
              </label>
              <div className="flex items-center gap-2">
                {isClipping && (
                  <span className="text-[10px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded font-bold animate-pulse border border-rose-500/30">
                    CLIPPING
                  </span>
                )}
                <span className={`text-xs font-mono px-2 py-1 rounded-md transition-colors ${isClipping ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/10'}`}>
                  {sensitivity}%
                </span>
              </div>
            </div>
            
            <div className="relative pt-2 pb-6">
              <input 
                type="range" 
                min="0" 
                max="100" 
                step="1"
                value={sensitivity}
                onChange={(e) => onSensitivityChange(parseInt(e.target.value))}
                className={`w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer appearance-none transition-all ${isClipping ? 'accent-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]' : 'accent-indigo-500'}`}
              />
              <div className="absolute top-7 left-0 right-0 flex justify-between text-[9px] font-bold text-slate-500 uppercase tracking-widest px-0.5">
                <span className={sensitivity < 33 ? 'text-indigo-400' : ''}>Low</span>
                <span className={sensitivity >= 33 && sensitivity < 66 ? 'text-indigo-400' : ''}>Medium</span>
                <span className={sensitivity >= 66 ? 'text-indigo-400' : ''}>High</span>
              </div>
            </div>

            <div className="pt-2">
              <div className="flex justify-between items-center mb-2">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Signal Level</p>
                <span className={`text-[10px] uppercase font-bold tracking-tighter transition-colors ${isClipping ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`}>
                  {isClipping ? 'Peak' : 'Live Monitor'}
                </span>
              </div>
              <VolumeMeter stream={stream} sensitivity={sensitivity} onClip={handleClip} />
            </div>
          </div>

          <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-2">
            <p className="text-xs text-indigo-300 flex items-start gap-2">
              <i className="fas fa-info-circle mt-0.5"></i>
              <span>If the signal level turns red and "Peak" appears, reduce sensitivity to avoid audio distortion.</span>
            </p>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 mt-6"
        >
          Apply Changes
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;
