import React, { useEffect, useRef, useState } from 'react';
import { Hands, Results, VERSION, HAND_CONNECTIONS } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { motion } from 'motion/react';

interface HandTrackerProps {
  onPinch: (size: number) => void;
  onLandmarks: (results: Results) => void;
}

let handsInstance: Hands | null = null;
let initializePromise: Promise<void> | null = null;

const getHandsInstance = async (): Promise<Hands> => {
  if (!handsInstance) {
    handsInstance = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${VERSION}/${file}`,
    });
    handsInstance.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });
  }
  if (!initializePromise) {
    initializePromise = handsInstance.initialize();
  }
  await initializePromise;
  return handsInstance;
};

// MediaPipe reports handedness from model perspective (mirrored for webcam)
// So MediaPipe 'Left' = user's right hand, 'Right' = user's left hand
function getHandByUser(results: Results, userSide: 'left' | 'right') {
  const modelLabel = userSide === 'left' ? 'Right' : 'Left';
  if (!results.multiHandedness) return null;
  const idx = results.multiHandedness.findIndex(h => h.label === modelLabel);
  return idx >= 0 ? results.multiHandLandmarks?.[idx] ?? null : null;
}

function normalizedPinchDist(landmarks: any[]) {
  const thumb = landmarks[4], index = landmarks[8];
  const wrist = landmarks[0], indexMCP = landmarks[5];
  const dist = Math.sqrt(
    Math.pow(thumb.x - index.x, 2) +
    Math.pow(thumb.y - index.y, 2) +
    Math.pow(thumb.z - index.z, 2)
  );
  const palm = Math.sqrt(
    Math.pow(wrist.x - indexMCP.x, 2) +
    Math.pow(wrist.y - indexMCP.y, 2)
  ) || 0.1;
  return dist / palm;
}

const HandTracker: React.FC<HandTrackerProps> = ({ onPinch, onLandmarks }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isCurrentlyPinching, setIsCurrentlyPinching] = useState(false);
  const [sphereSize, setSphereSize] = useState(0.5);
  const [leftHandActive, setLeftHandActive] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const lastPinchRef = useRef(false);
  const sphereSizeRef = useRef(0.5);
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

          // Draw skeleton
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.save();
              ctx.scale(-1, 1);
              ctx.translate(-canvas.width, 0);
              if (results.multiHandLandmarks) {
                for (const landmarks of results.multiHandLandmarks) {
                  drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#22c55e', lineWidth: 2 });
                  drawLandmarks(ctx, landmarks, { color: '#ff3333', fillColor: '#cc0000', lineWidth: 1, radius: 3 });
                }
              }
              ctx.restore();
            }
          }

          if (!results.multiHandLandmarks?.length) {
            if (lastPinchRef.current) { setIsCurrentlyPinching(false); lastPinchRef.current = false; }
            setLeftHandActive(false);
            return;
          }

          // Left hand: index-thumb spread controls sphere size
          const leftLandmarks = getHandByUser(results, 'left');
          if (leftLandmarks) {
            const thumb = leftLandmarks[4], index = leftLandmarks[8];
            const wrist = leftLandmarks[0], indexMCP = leftLandmarks[5];
            const spread = Math.sqrt(
              Math.pow(thumb.x - index.x, 2) + Math.pow(thumb.y - index.y, 2)
            );
            const palm = Math.sqrt(
              Math.pow(wrist.x - indexMCP.x, 2) + Math.pow(wrist.y - indexMCP.y, 2)
            ) || 0.1;
            // Map normalized spread to size: closed fist ≈ 0.3, fully open ≈ 2.5
            const normalizedSpread = spread / palm;
            const size = Math.max(0.3, Math.min(2.5, normalizedSpread * 2.2));
            sphereSizeRef.current = size;
            setSphereSize(size);
            setLeftHandActive(true);
          } else {
            setLeftHandActive(false);
          }

          // Right hand: pinch triggers release
          const rightLandmarks = getHandByUser(results, 'right');
          if (rightLandmarks) {
            const norm = normalizedPinchDist(rightLandmarks);
            const wasPinching = lastPinchRef.current;
            const isPinching = wasPinching ? norm < 0.45 : norm < 0.28;

            if (isPinching && !lastPinchRef.current) {
              onPinch(sphereSizeRef.current);
            }
            if (isPinching !== lastPinchRef.current) setIsCurrentlyPinching(isPinching);
            lastPinchRef.current = isPinching;
          } else {
            // Fallback: use first detected hand for pinch if only one present
            const onlyLandmarks = results.multiHandLandmarks[0];
            if (!leftLandmarks && onlyLandmarks) {
              const norm = normalizedPinchDist(onlyLandmarks);
              const wasPinching = lastPinchRef.current;
              const isPinching = wasPinching ? norm < 0.45 : norm < 0.28;
              if (isPinching && !lastPinchRef.current) onPinch(sphereSizeRef.current);
              if (isPinching !== lastPinchRef.current) setIsCurrentlyPinching(isPinching);
              lastPinchRef.current = isPinching;
            } else if (!leftLandmarks) {
              if (lastPinchRef.current) { setIsCurrentlyPinching(false); lastPinchRef.current = false; }
            }
          }
        });

        const camera = new Camera(videoRef.current!, {
          onFrame: async () => {
            if (isEffectActive && activeRef.current && videoRef.current) {
              try { await hands.send({ image: videoRef.current }); }
              catch (e) { if (isEffectActive) console.error('Hands send error', e); }
            }
          },
          width: 640,
          height: 480,
        });

        camera.start().then(() => {
          if (isEffectActive && activeRef.current) setIsLoaded(true);
        }).catch((err: Error) => {
          if (isEffectActive && activeRef.current) {
            setPermissionError(err.name === 'NotAllowedError' ? 'Permission Denied' : 'Camera Error: ' + err.message);
          }
        });

        cameraRef.current = camera;
      } catch (err: any) {
        if (isEffectActive && activeRef.current) setPermissionError('Init Error: ' + err.message);
      }
    };

    init();

    return () => {
      isEffectActive = false;
      activeRef.current = false;
      if (cameraRef.current) { cameraRef.current.stop(); cameraRef.current = null; }
    };
  }, [onPinch, onLandmarks, retryCount]);

  return (
    <div className="absolute top-28 right-10 w-56 bg-[#111] border border-white/20 rounded-lg overflow-hidden flex flex-col z-50 shadow-2xl">
      <div className="h-4 bg-[#222] flex items-center px-2 justify-between">
        <span className="text-[8px] uppercase tracking-tighter text-[#888]">
          {permissionError ? `Error: ${permissionError}` : 'Gestural Biosurface: Active'}
        </span>
        <div className={`w-1 h-1 rounded-full ${permissionError ? 'bg-red-500 animate-pulse' : (isLoaded ? 'bg-green-500' : 'bg-yellow-500')}`} />
      </div>

      <div className="h-36 flex items-center justify-center relative bg-black/40">
        {!isLoaded && !permissionError && (
          <div className="absolute inset-0 flex items-center justify-center text-white/50 text-[10px] uppercase tracking-widest text-center">
            Initializing...
          </div>
        )}
        {permissionError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-10 bg-black/80 backdrop-blur-sm">
            <span className="text-red-400 text-[10px] font-bold uppercase tracking-wider mb-2">Access Required</span>
            <span className="text-white/40 text-[8px] leading-relaxed mb-4">Enable camera to interact with the space</span>
            <button
              onClick={() => setRetryCount(prev => prev + 1)}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded text-[9px] text-white uppercase tracking-widest transition-colors"
            >
              Retry Access
            </button>
          </div>
        )}
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1] opacity-60 grayscale brightness-125" playsInline />
        <canvas ref={canvasRef} width={640} height={480} className="absolute inset-0 w-full h-full object-cover" />
        {isCurrentlyPinching && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="px-3 py-1 bg-green-500/80 backdrop-blur-sm rounded text-[9px] font-mono font-bold text-white uppercase tracking-wider animate-pulse">
              Release Sphere
            </div>
          </div>
        )}
      </div>

      <div className="p-2 border-t border-white/10 bg-[#0a0a0a] flex flex-col gap-1.5">
        {/* Left hand: size control */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className={`text-[8px] uppercase tracking-widest ${leftHandActive ? 'text-blue-400' : 'text-[#444]'}`}>
              L · Size
            </span>
            <span className="text-[9px] text-white font-mono">{sphereSize.toFixed(2)}x</span>
          </div>
          <div className="w-full bg-white/5 h-[2px] rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${((sphereSize - 0.3) / 2.2) * 100}%` }}
              className={`h-full ${leftHandActive ? 'bg-blue-400' : 'bg-white/30'}`}
            />
          </div>
        </div>
        {/* Right hand: pinch trigger */}
        <div className="flex justify-between items-center">
          <span className={`text-[8px] uppercase tracking-widest ${isCurrentlyPinching ? 'text-green-400' : 'text-[#444]'}`}>
            R · Pinch to Release
          </span>
          <div className={`w-1.5 h-1.5 rounded-full ${isCurrentlyPinching ? 'bg-green-400 animate-pulse' : 'bg-white/10'}`} />
        </div>
      </div>
    </div>
  );
};

export default HandTracker;
