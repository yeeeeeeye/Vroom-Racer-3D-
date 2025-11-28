import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GameScene } from './components/GameScene';
import { Controller } from './components/Controller';

// --- Sound Synthesizer ---
const SoundManager = {
  ctx: null as AudioContext | null,
  init: () => {
    if (!SoundManager.ctx) {
      SoundManager.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  },
  ensureContext: () => {
    if (SoundManager.ctx && SoundManager.ctx.state === 'suspended') {
      SoundManager.ctx.resume();
    }
  },
  playCollect: () => {
    if (!SoundManager.ctx) return;
    SoundManager.ensureContext();
    const osc = SoundManager.ctx.createOscillator();
    const gain = SoundManager.ctx.createGain();
    osc.connect(gain);
    gain.connect(SoundManager.ctx.destination);
    
    // Triangle wave cuts through noise better than sine
    osc.type = 'triangle'; 
    osc.frequency.setValueAtTime(600, SoundManager.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, SoundManager.ctx.currentTime + 0.1);
    
    // MAX VOLUME
    gain.gain.setValueAtTime(1.0, SoundManager.ctx.currentTime); 
    gain.gain.exponentialRampToValueAtTime(0.01, SoundManager.ctx.currentTime + 0.5);
    
    osc.start();
    osc.stop(SoundManager.ctx.currentTime + 0.5);
  },
  playBoost: () => {
    if (!SoundManager.ctx) return;
    SoundManager.ensureContext();
    const osc = SoundManager.ctx.createOscillator();
    const gain = SoundManager.ctx.createGain();
    osc.connect(gain);
    gain.connect(SoundManager.ctx.destination);
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, SoundManager.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(800, SoundManager.ctx.currentTime + 0.4);
    
    // MAX VOLUME
    gain.gain.setValueAtTime(0.8, SoundManager.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, SoundManager.ctx.currentTime + 0.4);
    
    osc.start();
    osc.stop(SoundManager.ctx.currentTime + 0.4);
  },
  playCrash: () => {
    if (!SoundManager.ctx) return;
    SoundManager.ensureContext();
    const osc = SoundManager.ctx.createOscillator();
    const gain = SoundManager.ctx.createGain();
    osc.connect(gain);
    gain.connect(SoundManager.ctx.destination);
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(100, SoundManager.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, SoundManager.ctx.currentTime + 0.3);
    
    gain.gain.setValueAtTime(0.5, SoundManager.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, SoundManager.ctx.currentTime + 0.3);
    
    osc.start();
    osc.stop(SoundManager.ctx.currentTime + 0.3);
  }
};

export default function App() {
  // Game State
  const [speed, setSpeed] = useState(0);
  const [steering, setSteering] = useState(0); // -1 to 1
  const [isReady, setIsReady] = useState(false);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState("");
  const [isClenched, setIsClenched] = useState(false);
  const [terrain, setTerrain] = useState<'road' | 'grass'>('road');

  // Refs for physics loop
  const speedRef = useRef(0);
  const terrainRef = useRef<'road' | 'grass'>('road');
  
  // Update refs when state changes
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { terrainRef.current = terrain; }, [terrain]);

  // Init Audio on interaction
  useEffect(() => {
    const handleInteract = () => SoundManager.init();
    window.addEventListener('click', handleInteract);
    window.addEventListener('touchstart', handleInteract);
    window.addEventListener('keydown', handleInteract);
    return () => {
      window.removeEventListener('click', handleInteract);
      window.removeEventListener('touchstart', handleInteract);
      window.removeEventListener('keydown', handleInteract);
    };
  }, []);

  const handleSensorUpdate = useCallback((newVolume: number, newSteering: number, bothFistsClenched: boolean) => {
    // --- Physics Constants ---
    
    // 1. Noise Gate: Higher threshold (0.1) to ignore background noise
    const VOLUME_THRESHOLD = 0.1; 
    
    // 2. Volume Range: Map volume 0.1 -> 0.5 to Speed 0 -> 80
    const MAX_EFFECTIVE_VOLUME = 0.5;
    const MAX_SPEED = 80;
    
    setIsClenched(bothFistsClenched);

    setSpeed((prevSpeed) => {
        let targetSpeed = 0;

        // TARGET SPEED LOGIC:
        // If fists are clenched AND volume is above threshold, calculate target speed.
        // Otherwise, target speed is 0 (Braking).
        if (newVolume > VOLUME_THRESHOLD && bothFistsClenched) {
            // Normalize volume (0 to 1 range based on effective window)
            const normalizedVol = Math.min(1, (newVolume - VOLUME_THRESHOLD) / (MAX_EFFECTIVE_VOLUME - VOLUME_THRESHOLD));
            targetSpeed = normalizedVol * MAX_SPEED;
        }

        // Apply Terrain Penalty to Target
        if (terrainRef.current === 'grass') {
            targetSpeed *= 0.3; // Grass slows you down to 30% speed
        }

        let nextSpeed = prevSpeed;

        // Smooth Interpolation towards Target
        if (targetSpeed > prevSpeed) {
            // Acceleration: Slow gentle build up
            nextSpeed += 0.5; 
        } else {
            // Deceleration: Faster braking for control
            nextSpeed -= 1.0; 
        }

        // Ensure we don't overshoot
        if (Math.abs(nextSpeed - targetSpeed) < 1.0) {
            nextSpeed = targetSpeed;
        }

        return Math.max(0, Math.min(nextSpeed, MAX_SPEED));
    });

    // Steering Smoothing & Sensitivity
    setSteering((prev) => {
      // Non-linear sensitivity
      const sign = Math.sign(newSteering);
      const curvedSteering = sign * Math.pow(Math.abs(newSteering), 1.5);

      const SENSITIVITY = 1.2; 
      const target = -curvedSteering * SENSITIVITY;
      
      const SMOOTHING = 0.1;
      return prev + (target - prev) * SMOOTHING;
    });
  }, []);

  const handleScore = (type: 'light' | 'pineapple') => {
    if (type === 'light') {
      setScore(s => s + 1);
      SoundManager.playCollect();
    } else if (type === 'pineapple') {
      setScore(s => s + 10);
      setSpeed(s => Math.min(s + 20, 80)); 
      SoundManager.playBoost();
      setMessage("YUMMY!");
      setTimeout(() => setMessage(""), 1000);
    }
  };

  const handleCrash = () => {
      SoundManager.playCrash();
      setSpeed((s) => 0); // Stop on crash
      setMessage("OUCH!");
      setTimeout(() => setMessage(""), 800);
  };

  const handleTerrainChange = (type: 'road' | 'grass') => {
      setTerrain(type);
  };

  return (
    <div className="h-full w-full flex flex-row bg-slate-900 overflow-hidden select-none font-soft">
      {/* LEFT 1/4: Camera & Sensors */}
      <div className="w-1/4 h-full relative border-r border-white/20 box-border z-20 bg-gray-900 shadow-2xl flex flex-col">
        
        {/* Title Card */}
        <div className="p-4 bg-gradient-to-r from-emerald-800 to-teal-900 text-center shadow-lg z-10">
          <h1 className="text-2xl lg:text-3xl font-cartoon text-white drop-shadow-md tracking-wider">VOOM RACER</h1>
          <p className="text-[10px] font-bold text-white/50 mt-1 uppercase tracking-[0.3em]">Zen Edition</p>
        </div>

        {/* Camera Feed Container */}
        <div className={`flex-1 relative overflow-hidden bg-black transition-all duration-500 box-border ${isClenched ? 'shadow-[inset_0_0_60px_rgba(52,211,153,0.4)] border-4 border-emerald-500/40' : 'border-4 border-transparent'}`}>
           <Controller 
            onUpdate={handleSensorUpdate} 
            onReady={() => setIsReady(true)}
          />

          {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-30 p-4 text-center">
              <div>
                <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-emerald-200 font-cartoon text-lg tracking-wide">Growing World...</p>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="p-5 bg-slate-900 text-slate-400 text-sm space-y-4 border-t border-white/10">
           <div className={`flex items-center gap-3 transition-opacity duration-300 ${isClenched ? 'opacity-100 text-white' : 'opacity-60'}`}>
             <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg transition-colors ${isClenched ? 'bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.6)]' : 'bg-slate-800'}`}>✊</div>
             <p className="leading-tight flex-1 font-light">Hold <span className="font-bold text-emerald-400">BOTH FISTS</span> to steer.</p>
           </div>
           <div className="flex items-center gap-3 opacity-80">
             <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-lg">🗣️</div>
             <p className="leading-tight flex-1 font-light">Make noise to <span className="font-bold text-yellow-500">ACCELERATE</span>.</p>
           </div>
           {terrain === 'grass' && (
               <div className="text-center text-xs text-orange-400 font-bold animate-pulse">
                   OFF ROAD - SLOW DOWN
               </div>
           )}
           <div className="text-center pt-4">
              <button 
                onClick={() => SoundManager.init()}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-xs text-white uppercase tracking-widest transition-colors"
              >
                Enable Sound
              </button>
           </div>
        </div>
      </div>

      {/* RIGHT 3/4: 3D Game */}
      <div className="w-3/4 h-full relative bg-gray-900">
        
        {/* Game HUD */}
        <div className="absolute top-8 left-8 z-10 flex gap-6 pointer-events-none">
           {/* Speedometer - Narrower width (9rem) */}
           <div className="min-w-[9rem] bg-black/20 backdrop-blur-md border border-white/20 rounded-3xl p-4 shadow-xl flex flex-col justify-between">
              <div className="text-[10px] font-bold text-white uppercase tracking-widest mb-1">Speed</div>
              <div className="flex items-baseline gap-2">
                <span className={`text-5xl font-cartoon tabular-nums tracking-tighter drop-shadow-sm text-white opacity-100 ${speed > 70 ? 'text-red-300' : ''}`}>
                  {Math.round(Math.abs(speed)).toString().padStart(2, '0')}
                </span>
                <span className="text-xs font-bold text-white opacity-100">km/h</span>
              </div>
              <div className="w-full h-1.5 bg-white/10 mt-3 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-200 ease-out ${terrain === 'grass' ? 'bg-orange-500' : 'bg-gradient-to-r from-emerald-400 to-cyan-400'}`}
                  style={{ width: `${Math.min((Math.abs(speed) / 80) * 100, 100)}%` }}
                ></div>
              </div>
           </div>
           
           {/* Score - Narrower width (9rem) */}
           <div className="min-w-[9rem] bg-black/20 backdrop-blur-md border border-white/20 rounded-3xl p-4 shadow-xl flex items-center gap-4">
              <span className="text-4xl filter drop-shadow-md">✨</span>
              <div>
                <div className="text-[10px] font-bold text-white uppercase tracking-widest">Score</div>
                <span className="text-4xl font-cartoon text-white drop-shadow-md tabular-nums opacity-100">{score}</span>
              </div>
           </div>
        </div>

        {/* Feedback Message */}
        {message && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-bounce pointer-events-none">
            <span className="text-6xl font-cartoon text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] tracking-widest whitespace-nowrap">
              {message}
            </span>
          </div>
        )}

        <GameScene 
            speed={speed} 
            steering={steering} 
            onScore={handleScore} 
            onCrash={handleCrash}
            onTerrainChange={handleTerrainChange}
        />
      </div>
    </div>
  );
}