import React, { useEffect, useRef, useState } from 'react';
import { Hands, Results, VERSION } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { motion } from 'motion/react';

interface HandTrackerProps {
  onPinch: (size: number) => void;
  onLandmarks: (results: Results) => void;
}

// Module-level singleton to avoid Emscripten double-initialization issues in React Strict Mode
let handsInstance: Hands | null = null;
let initializePromise: Promise<Hands> | null = null;

const getHandsInstance = async (): Promise<Hands> => {
  if (!handsInstance) {
    handsInstance = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${VERSION}/${file}`,
    });
    handsInstance.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  }
  
  if (!initializePromise) {
    initializePromise = handsInstance.initialize().then(() => handsInstance!);
  }
  
  return initializePromise;
};

const HandTracker: React.FC<HandTrackerProps> = ({ onPinch, onLandmarks }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isCurrentlyPinching, setIsCurrentlyPinching] = useState(false);
  const [handDistance, setHandDistance] = useState(0.5);
  const [retryCount, setRetryCount] = useState(0);
  const lastStateRef = useRef(false);
  const activeRef = useRef(true);
  const cameraRef = useRef<Camera | null>(null);

  useEffect(() => {
    activeRef.current = true;
    setPermissionError(null);
    if (!videoRef.current) return;

    let isEffectActive = true;

    const init = async () => {
      try {
        const hands = await getHandsInstance();
        
        if (!isEffectActive || !activeRef.current) return;

        hands.onResults((results: Results) => {
          if (!isEffectActive || !activeRef.current) return;
          onLandmarks(results);

          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];

            const pinchDist = Math.sqrt(
              Math.pow(thumbTip.x - indexTip.x, 2) +
              Math.pow(thumbTip.y - indexTip.y, 2) +
              Math.pow(thumbTip.z - indexTip.z, 2)
            );

            const currentPinch = pinchDist < 0.05;
            
            let currentSize = 0.5;
            if (results.multiHandLandmarks.length === 2) {
              const h1 = results.multiHandLandmarks[0][8];
              const h2 = results.multiHandLandmarks[1][8];
              const distHands = Math.sqrt(
                Math.pow(h1.x - h2.x, 2) +
                Math.pow(h1.y - h2.y, 2)
              );
              currentSize = Math.max(0.2, Math.min(1.5, distHands * 2.0));
              setHandDistance(currentSize);
            }

            if (currentPinch && !lastStateRef.current) {
              onPinch(currentSize);
            }
            
            if (currentPinch !== lastStateRef.current) {
              setIsCurrentlyPinching(currentPinch);
            }
            
            lastStateRef.current = currentPinch;
          } else {
            if (lastStateRef.current) {
              setIsCurrentlyPinching(false);
              lastStateRef.current = false;
            }
          }
        });

        const camera = new Camera(videoRef.current!, {
          onFrame: async () => {
            if (isEffectActive && activeRef.current && videoRef.current) {
              try {
                await hands.send({ image: videoRef.current });
              } catch (e) {
                // Ignore send errors when effect is tearing down
                if (isEffectActive) console.error("Hands send error", e);
              }
            }
          },
          width: 640,
          height: 480,
        });

        camera.start().then(() => {
          if (isEffectActive && activeRef.current) setIsLoaded(true);
        }).catch((err: Error) => {
          console.error("Camera start error:", err);
          if (isEffectActive && activeRef.current) {
            setPermissionError(err.name === 'NotAllowedError' ? 'Permission Denied' : 'Camera Error');
          }
        });
        
        // Store camera locally to stop it cleanly inside the useEffect cleanup
        cameraRef.current = camera;
      } catch (err) {
        console.error("Hands initialize error", err);
      }
    };

    init();

    return () => {
      isEffectActive = false;
      activeRef.current = false;
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
    };
  }, [onPinch, onLandmarks, retryCount]);

  return (
    <div className="absolute top-28 right-10 w-56 h-40 bg-[#111] border border-white/20 rounded-lg overflow-hidden flex flex-col z-50 shadow-2xl">
      <div className="h-4 bg-[#222] flex items-center px-2 justify-between">
        <span className="text-[8px] uppercase tracking-tighter text-[#888]">
          {permissionError ? `Error: ${permissionError}` : 'Gestural Biosurface: Active'}
        </span>
        <div className="flex gap-1">
          <div className={`w-1 h-1 rounded-full ${permissionError ? 'bg-red-500 animate-pulse' : (isLoaded ? 'bg-green-500' : 'bg-yellow-500')}`}></div>
        </div>
      </div>
      <div className="flex-grow flex items-center justify-center relative bg-black/40">
        {!isLoaded && !permissionError && (
          <div className="absolute inset-0 flex items-center justify-center text-white/50 text-[10px] uppercase tracking-widest text-center">
            Initializing...
          </div>
        )}
        {permissionError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-10 bg-black/80 backdrop-blur-sm">
            <span className="text-red-400 text-[10px] font-bold uppercase tracking-wider mb-2">Access Required</span>
            <span className="text-white/40 text-[8px] leading-relaxed mb-4">Please enable camera to interact with the space</span>
            <button 
              onClick={() => setRetryCount(prev => prev + 1)}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded text-[9px] text-white uppercase tracking-widest transition-colors"
            >
              Retry Access
            </button>
          </div>
        )}
        <video
          ref={videoRef}
          className="w-full h-full object-cover scale-x-[-1] opacity-60 grayscale brightness-125"
          playsInline
        />
        {isCurrentlyPinching && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div className="px-3 py-1 bg-green-500/80 backdrop-blur-sm rounded text-[9px] font-mono font-bold text-white uppercase tracking-wider animate-pulse">
               Release Sphere
             </div>
          </div>
        )}
      </div>
      <div className="p-2 border-t border-white/10 bg-[#0a0a0a]">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[8px] uppercase tracking-widest text-[#666]">Scale Modulation</span>
          <span className="text-[9px] text-white font-mono">{handDistance.toFixed(2)}x</span>
        </div>
        <div className="w-full bg-white/5 h-[2px] rounded-full overflow-hidden">
          <motion.div 
            animate={{ width: `${(handDistance / 1.5) * 100}%` }}
            className="bg-white h-full"
          />
        </div>
      </div>
    </div>
  );
};

export default HandTracker;
