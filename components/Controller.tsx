import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

interface ControllerProps {
  onUpdate: (volume: number, steering: number, fistsClenched: boolean) => void;
  onReady: () => void;
}

export const Controller: React.FC<ControllerProps> = ({ onUpdate, onReady }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs for loop management
  const requestRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);

  // Initialize Sensors
  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        // 1. Load MediaPipe Hand Landmarker (2 hands)
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });
        handLandmarkerRef.current = handLandmarker;

        // 2. Setup Camera & Mic
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: true
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => {
            if(active) {
                onReady();
                startLoop();
            }
          };
        }

        // 3. Setup Audio Analysis
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512; // Higher resolution for better low-end detection
        analyser.smoothingTimeConstant = 0.5; 
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        
        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      } catch (err: any) {
        console.error(err);
        setError("Error: " + err.message);
      }
    };

    init();

    return () => {
      active = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startLoop = () => {
    const loop = () => {
      processFrame();
      requestRef.current = requestAnimationFrame(loop);
    };
    loop();
  };

  const isFist = (landmarks: any[]) => {
      const wrist = landmarks[0];
      const fingerTips = [8, 12, 16, 20];
      const fingerMCPs = [5, 9, 13, 17];
      
      let curledCount = 0;
      for(let i=0; i<4; i++) {
          const tip = landmarks[fingerTips[i]];
          const mcp = landmarks[fingerMCPs[i]];
          
          const distTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
          const distMcp = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y);
          
          // Relaxed threshold: 1.3 -> 1.6
          // This allows looser fists (fingertips further from wrist) to still count
          if (distTip < distMcp * 1.6) {
              curledCount++;
          }
      }
      // Thumb check (simple)
      const thumbTip = landmarks[4];
      const thumbMcp = landmarks[2];
      // Relaxed threshold: 0.15 -> 0.25 (Allows thumb to be less tightly tucked)
      if(Math.hypot(thumbTip.x - thumbMcp.x, thumbTip.y - thumbMcp.y) < 0.25) curledCount++;

      return curledCount >= 3;
  };

  const drawSkeleton = (ctx: CanvasRenderingContext2D, landmarks: any[], color: string, videoW: number, videoH: number) => {
    // Connections based on standard MediaPipe Hand Topology
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8], // Index
        [0, 9], [9, 10], [10, 11], [11, 12], // Middle
        [0, 13], [13, 14], [14, 15], [15, 16], // Ring
        [0, 17], [17, 18], [18, 19], [19, 20] // Pinky
    ];

    ctx.lineWidth = 2;
    ctx.strokeStyle = color;

    // Draw connections
    for (const [start, end] of connections) {
        const p1 = landmarks[start];
        const p2 = landmarks[end];
        ctx.beginPath();
        ctx.moveTo(p1.x * videoW, p1.y * videoH);
        ctx.lineTo(p2.x * videoW, p2.y * videoH);
        ctx.stroke();
    }

    // Draw joints
    ctx.fillStyle = color;
    for (const lm of landmarks) {
        ctx.beginPath();
        ctx.arc(lm.x * videoW, lm.y * videoH, 3, 0, 2 * Math.PI);
        ctx.fill();
    }
  };

  const processFrame = () => {
    let currentVolume = 0;
    let currentSteering = 0;
    let fistsClenched = false;

    // --- Audio Processing ---
    if (analyserRef.current && dataArrayRef.current) {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      let sum = 0;
      const limit = Math.min(dataArrayRef.current.length, 50);
      for (let i = 0; i < limit; i++) {
        sum += dataArrayRef.current[i] * dataArrayRef.current[i];
      }
      const rms = Math.sqrt(sum / limit);
      currentVolume = Math.min(rms / 128, 1.0);
    }

    // --- Video Processing ---
    if (videoRef.current && handLandmarkerRef.current && videoRef.current.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = videoRef.current.currentTime;
        const results = handLandmarkerRef.current.detectForVideo(videoRef.current, performance.now());
        
        if(canvasRef.current && videoRef.current) {
            const videoW = videoRef.current.videoWidth;
            const videoH = videoRef.current.videoHeight;
            canvasRef.current.width = videoW;
            canvasRef.current.height = videoH;
            const ctx = canvasRef.current.getContext('2d');
            
            if(ctx) {
                ctx.clearRect(0, 0, videoW, videoH);
                ctx.save();
                
                if (results.landmarks && results.landmarks.length === 2) {
                    const hand1 = results.landmarks[0];
                    const hand2 = results.landmarks[1];

                    // 1. Detect Gestures
                    const fist1 = isFist(hand1);
                    const fist2 = isFist(hand2);
                    fistsClenched = fist1 && fist2;

                    // 2. Sorting Hands (Left vs Right on screen)
                    const getCentroid = (lm: any[]) => ({ x: lm[9].x, y: lm[9].y });
                    const c1 = getCentroid(hand1);
                    const c2 = getCentroid(hand2);
                    const hands = [c1, c2].sort((a, b) => a.x - b.x);
                    const leftHand = hands[0]; 
                    const rightHand = hands[1]; 

                    // 3. Draw Skeletons
                    drawSkeleton(ctx, hand1, fist1 ? '#a5b4fc' : 'rgba(255,255,255,0.5)', videoW, videoH);
                    drawSkeleton(ctx, hand2, fist2 ? '#a5b4fc' : 'rgba(255,255,255,0.5)', videoW, videoH);

                    // 4. Steering Calculation
                    const dx = rightHand.x - leftHand.x;
                    const dy = rightHand.y - leftHand.y;
                    const angle = Math.atan2(dy, dx);
                    
                    const MAX_ANGLE = 0.6; // ~35 degrees
                    const clampedAngle = Math.max(-MAX_ANGLE, Math.min(angle, MAX_ANGLE));
                    currentSteering = (clampedAngle / MAX_ANGLE) * 1.5; // Multiplier for responsiveness

                    // 5. Draw Steering Wheel Visuals
                    const centerX = (c1.x + c2.x) / 2 * videoW;
                    const centerY = (c1.y + c2.y) / 2 * videoH;
                    const radius = Math.hypot((c2.x - c1.x)*videoW, (c2.y - c1.y)*videoH) / 2;
                    
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                    ctx.lineWidth = 10;
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                    ctx.stroke();

                    // Active Arc based on steering
                    ctx.beginPath();
                    const startAngle = Math.PI - 0.5; 
                    const endAngle = Math.PI * 2 + 0.5;
                    ctx.arc(centerX, centerY, radius, startAngle + angle, endAngle + angle);
                    ctx.lineWidth = 4;
                    ctx.strokeStyle = fistsClenched ? '#818cf8' : 'rgba(255,255,255,0.4)'; // Indigo or transparent white
                    ctx.stroke();

                }
                ctx.restore();
            }
        }
    }

    onUpdate(currentVolume, currentSteering, fistsClenched);
  };

  return (
    <div className="w-full h-full relative bg-gray-900">
        <div className="w-full h-full transform -scale-x-100 relative">
            <video 
                ref={videoRef}
                autoPlay 
                playsInline
                muted
                className="w-full h-full object-cover absolute top-0 left-0 opacity-80"
            />
            <canvas 
                ref={canvasRef}
                className="w-full h-full object-cover absolute top-0 left-0 z-10"
            />
        </div>
        {error && <div className="absolute bottom-4 left-4 bg-red-600 text-white p-2 text-xs z-50">{error}</div>}
    </div>
  );
};