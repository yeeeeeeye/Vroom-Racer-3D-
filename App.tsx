import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GameScene } from './components/GameScene';
import { Controller } from './components/Controller';

// --- Sound Synthesizer ---
const SoundManager = {
  ctx: null as AudioContext | null,
  muted: false, // Default is NOT muted
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
  toggleMute: () => {
    SoundManager.muted = !SoundManager.muted;
    return SoundManager.muted;
  },
  playCollect: () => {
    if (!SoundManager.ctx || SoundManager.muted) return;
    SoundManager.ensureContext();
    const t = SoundManager.ctx.currentTime;
    const osc = SoundManager.ctx.createOscillator();
    const gain = SoundManager.ctx.createGain();
    osc.connect(gain);
    gain.connect(SoundManager.ctx.destination);
    
    // "Bright Ping" - Higher pitch, clean game sound
    osc.type = 'sine'; 
    osc.frequency.setValueAtTime(987.77, t); // B5 
    osc.frequency.exponentialRampToValueAtTime(1318.51, t + 0.1); // Slide to E6

    // Crisp Envelope
    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.05); 
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4); 
    
    osc.start(t);
    osc.stop(t + 0.4);
  },
  playBoost: () => {
    if (!SoundManager.ctx || SoundManager.muted) return;
    SoundManager.ensureContext();
    const t = SoundManager.ctx.currentTime;
    const osc = SoundManager.ctx.createOscillator();
    const gain = SoundManager.ctx.createGain();
    osc.connect(gain);
    gain.connect(SoundManager.ctx.destination);
    
    // "Bloop" - Cute jump sound
    osc.type = 'triangle'; 
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.linearRampToValueAtTime(800, t + 0.15);
    
    // Moderate Volume
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.3);
    
    osc.start(t);
    osc.stop(t + 0.3);
  },
  playCrash: () => {
    if (!SoundManager.ctx || SoundManager.muted) return;
    SoundManager.ensureContext();
    const t = SoundManager.ctx.currentTime;
    const osc = SoundManager.ctx.createOscillator();
    const gain = SoundManager.ctx.createGain();
    osc.connect(gain);
    gain.connect(SoundManager.ctx.destination);
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.3);
    
    gain.gain.setValueAtTime(0.3, t); 
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    
    osc.start(t);
    osc.stop(t + 0.3);
  }
};

// --- High Score Logic ---
const getWeeklyHighScore = () => {
    try {
        const storedScore = localStorage.getItem('voom_highscore');
        const storedDate = localStorage.getItem('voom_highscore_date');
        
        if (!storedScore || !storedDate) return 0;
        
        const now = Date.now();
        const recordDate = parseInt(storedDate, 10);
        const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
        
        // Reset if older than a week
        if (now - recordDate > ONE_WEEK) {
            localStorage.removeItem('voom_highscore');
            localStorage.setItem('voom_highscore_date', now.toString());
            return 0;
        }
        
        return parseInt(storedScore, 10);
    } catch (e) {
        return 0;
    }
};

const saveHighScore = (newScore: number) => {
    const currentHigh = getWeeklyHighScore();
    if (newScore > currentHigh) {
        localStorage.setItem('voom_highscore', newScore.toString());
        localStorage.setItem('voom_highscore_date', Date.now().toString());
        return newScore;
    }
    return currentHigh;
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
  
  // Game Flow State
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'finished'>('idle');
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes = 120 seconds
  const [highScore, setHighScore] = useState(getWeeklyHighScore());
  const [canRestart, setCanRestart] = useState(false); // Cooldown for restart
  const [isMuted, setIsMuted] = useState(false); // UI State for mute button

  // Refs for physics loop
  const speedRef = useRef(0);
  const terrainRef = useRef<'road' | 'grass'>('road');
  const gameStatusRef = useRef<'idle' | 'playing' | 'finished'>('idle');
  
  // Update refs when state changes
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { terrainRef.current = terrain; }, [terrain]);
  useEffect(() => { gameStatusRef.current = gameStatus; }, [gameStatus]);

  // Init Audio on interaction
  useEffect(() => {
    const handleInteract = () => {
        SoundManager.init();
        SoundManager.ensureContext(); 
    };
    window.addEventListener('click', handleInteract);
    window.addEventListener('touchstart', handleInteract);
    window.addEventListener('keydown', handleInteract);
    return () => {
      window.removeEventListener('click', handleInteract);
      window.removeEventListener('touchstart', handleInteract);
      window.removeEventListener('keydown', handleInteract);
    };
  }, []);

  // Timer Logic
  useEffect(() => {
    let timer: any;
    if (gameStatus === 'playing') {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            finishGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [gameStatus]);

  const finishGame = () => {
      setGameStatus('finished');
      setSpeed(0);
      const newHigh = saveHighScore(score);
      setHighScore(newHigh);
      
      // Allow restart after 1 second (was 2s, made faster for responsiveness)
      setCanRestart(false);
      setTimeout(() => setCanRestart(true), 1000);
  };

  const restartGame = useCallback(() => {
      setScore(0);
      setTimeLeft(120);
      setGameStatus('idle');
      setMessage("READY?");
      setTimeout(() => setMessage(""), 1000);
  }, []);

  const toggleSound = () => {
      const muted = SoundManager.toggleMute();
      setIsMuted(muted);
      if (!muted) SoundManager.ensureContext();
  };

  const handleSensorUpdate = useCallback((newVolume: number, newSteering: number, bothFistsClenched: boolean) => {
    setIsClenched(bothFistsClenched);

    // --- RESTART LOGIC ---
    if (gameStatusRef.current === 'finished') {
        setSpeed(0); // Force stop
        return;
    }

    // --- PHYSICS CONSTANTS ---
    const VOLUME_THRESHOLD = 0.1; 
    const MAX_EFFECTIVE_VOLUME = 0.5;
    const MAX_SPEED = 80;
    
    setSpeed((prevSpeed) => {
        let targetSpeed = 0;

        // TARGET SPEED LOGIC
        if (newVolume > VOLUME_THRESHOLD && bothFistsClenched) {
            const normalizedVol = Math.min(1, (newVolume - VOLUME_THRESHOLD) / (MAX_EFFECTIVE_VOLUME - VOLUME_THRESHOLD));
            targetSpeed = normalizedVol * MAX_SPEED;

            // --- START GAME LOGIC ---
            // If we are IDLE, and user is driving (Speed > 1), Start the Timer
            if (gameStatusRef.current === 'idle' && targetSpeed > 1) {
                setGameStatus('playing');
            }
        }

        // Terrain Penalty
        if (terrainRef.current === 'grass') {
            targetSpeed *= 0.3; 
        }

        let nextSpeed = prevSpeed;

        // Use Lerp (Linear Interpolation) for smooth transitions instead of fixed steps.
        // This prevents the +1/-1 jitter when speed is near the target.
        const LERP_FACTOR_ACCEL = 0.05; // Gentle acceleration
        const LERP_FACTOR_BRAKE = 0.1;  // Stronger braking

        const factor = targetSpeed > prevSpeed ? LERP_FACTOR_ACCEL : LERP_FACTOR_BRAKE;
        
        nextSpeed = prevSpeed + (targetSpeed - prevSpeed) * factor;

        // Snap to zero if very small
        if (Math.abs(nextSpeed) < 0.1) {
            nextSpeed = 0;
        }

        return Math.max(0, Math.min(nextSpeed, MAX_SPEED));
    });

    // Steering
    setSteering((prev) => {
      const sign = Math.sign(newSteering);
      const curvedSteering = sign * Math.pow(Math.abs(newSteering), 1.5);
      const SENSITIVITY = 1.2; 
      const target = -curvedSteering * SENSITIVITY;
      const SMOOTHING = 0.1;
      return prev + (target - prev) * SMOOTHING;
    });
  }, [restartGame, canRestart]);

  const handleScore = (type: 'light' | 'pineapple') => {
    if (gameStatusRef.current === 'finished') return;

    if (type === 'light') {
      setScore(s => s + 1);
      SoundManager.playCollect();
    } else if (type === 'pineapple') {
      setScore(s => s + 5); 
      SoundManager.playBoost();
      setMessage("+5 PTS!");
      setTimeout(() => setMessage(""), 800);
    }
  };

  const handleCrash = () => {
      if (gameStatusRef.current === 'finished') return;
      SoundManager.playCrash();
      setSpeed((s) => 0); // Stop on crash
      setMessage("OUCH!");
      setTimeout(() => setMessage(""), 800);
  };

  const handleTerrainChange = (type: 'road' | 'grass') => {
      setTerrain(type);
  };

  // Timer Formatter
  const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full w-full flex flex-row bg-slate-900 overflow-hidden select-none font-soft">
      {/* LEFT 1/4: Camera & Sensors */}
      <div className="w-1/4 h-full relative border-r border-white/20 box-border z-20 bg-gray-900 shadow-2xl flex flex-col">
        
        {/* Title Card */}
        <div className="p-4 bg-gradient-to-r from-emerald-800 to-teal-900 text-center shadow-lg z-10">
          <h1 className="text-2xl lg:text-3xl font-cartoon text-white drop-shadow-md tracking-wider">VROOM RACER</h1>
          <div className="flex items-center justify-center gap-2 mt-2">
               <span className="text-3xl filter drop-shadow-md opacity-100">🍍</span>
               <span className="text-[10px] font-bold text-white/50 uppercase tracking-[0.3em] pt-1">EDITION</span>
          </div>
        </div>

        {/* Camera Feed */}
        {/* Updated Border/Glow logic: Brighter emerald-300 border and glowing inset shadow */}
        <div className={`flex-1 relative overflow-hidden bg-black transition-all duration-500 box-border ${isClenched ? 'shadow-[inset_0_0_60px_rgba(110,231,183,0.6)] border-4 border-emerald-300' : 'border-4 border-transparent'}`}>
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

           {/* OFF ROAD WARNING OVERLAY */}
           {terrain === 'grass' && (
             <div className="absolute bottom-4 left-0 right-0 flex justify-center z-30 pointer-events-none">
               <span className="bg-orange-500/90 text-white text-[10px] md:text-xs font-bold px-3 py-1 rounded-full animate-pulse shadow-lg border border-white/20 tracking-wider">
                  ⚠️ OFF ROAD
               </span>
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
           {/* Off road text removed from here */}

           <div className="text-center pt-4 flex justify-center">
              <button 
                onClick={toggleSound}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all bg-white/5 hover:bg-white/10 border border-white/10 text-xl`}
                title={isMuted ? "Enable Sound" : "Disable Sound"}
              >
                {isMuted ? '🔇' : '🔊'}
              </button>
           </div>
        </div>
      </div>

      {/* RIGHT 3/4: 3D Game */}
      <div className="w-3/4 h-full relative bg-gray-900">
        
        {/* Top HUD Row */}
        <div className="absolute top-8 left-8 right-8 z-10 flex justify-between pointer-events-none">
           <div className="flex gap-6">
                {/* Speedometer */}
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
                
                {/* Score */}
                <div className="min-w-[9rem] bg-black/20 backdrop-blur-md border border-white/20 rounded-3xl p-4 shadow-xl flex items-center gap-4">
                    <span className="text-4xl filter drop-shadow-md">✨</span>
                    <div>
                        <div className="text-[10px] font-bold text-white uppercase tracking-widest">Score</div>
                        <span className="text-4xl font-cartoon text-white drop-shadow-md tabular-nums opacity-100">{score}</span>
                    </div>
                </div>
           </div>

           {/* TIMER HUD */}
           <div className={`min-w-[8rem] h-[5rem] bg-black/20 backdrop-blur-md border border-white/20 rounded-3xl p-4 shadow-xl flex flex-col items-center justify-center transition-colors duration-500 ${timeLeft < 10 && gameStatus === 'playing' ? 'bg-red-900/40 border-red-500/50' : ''}`}>
               <div className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">Time Left</div>
               <span className="text-4xl font-cartoon text-white tabular-nums drop-shadow-md">
                   {formatTime(timeLeft)}
               </span>
           </div>
        </div>

        {/* FEEDBACK OVERLAY */}
        {message && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 animate-bounce pointer-events-none">
            <span className="text-6xl font-cartoon text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] tracking-widest whitespace-nowrap">
              {message}
            </span>
          </div>
        )}

        {/* GAME OVER RESULT SCREEN */}
        {gameStatus === 'finished' && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-in fade-in duration-500">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-3xl border-2 border-white/20 shadow-2xl text-center max-w-md w-full transform scale-110">
                    <h2 className="text-5xl font-cartoon text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-400 mb-2 drop-shadow-sm">TIME'S UP!</h2>
                    
                    <div className="my-8 space-y-4">
                        <div className="bg-black/30 p-4 rounded-2xl">
                            <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Total Score</p>
                            <p className="text-7xl font-cartoon text-white drop-shadow-lg">{score}</p>
                        </div>
                        <div className="flex items-center justify-center gap-2 text-yellow-400">
                             <span>👑</span>
                             <span className="text-sm font-bold uppercase tracking-wider">Weekly Best: {Math.max(highScore, score)}</span>
                        </div>
                    </div>

                    <div className="mt-8">
                       {/* Space reserved for layout balance */}
                    </div>
                </div>

                {/* Restart Button at bottom of screen */}
                <button 
                    onClick={restartGame}
                    className="absolute bottom-12 px-12 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 rounded-full shadow-[0_0_40px_rgba(16,185,129,0.5)] text-white font-cartoon text-4xl tracking-widest transform transition-all hover:scale-105 active:scale-95 border-4 border-white/20"
                >
                    GO 🚗💨
                </button>
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