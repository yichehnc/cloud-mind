import React, { useEffect, useState, useCallback, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, login, handleFirestoreError, OperationType } from './lib/firebase';
import Experience from './components/Experience';
import EmotionInput, { EMOTION_PRESETS, getCustomEmotionColor } from './components/EmotionInput';
import HandTracker from './components/HandTracker';
import { Power, PowerOff } from 'lucide-react';
import { Results } from '@mediapipe/hands';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useSoundEngine } from './lib/useSoundEngine';

// Help generate a hex color from a string
const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    let value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).substr(-2);
  }
  return color;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState('Happy');
  const [showNotification, setShowNotification] = useState(false);
  const [isRunning, setIsRunning] = useState(true);
  const [handResults, setHandResults] = useState<Results | null>(null);
  const lastAddRef = useRef(0);
  const { play } = useSoundEngine();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsReady(true);
    });
    return () => unsubscribe();
  }, []);

  const addSphere = useCallback(async (emotion: string, size: number = 0.5) => {
    if (!auth.currentUser) return;
    
    // Rate limit adds to once every 500ms
    if (Date.now() - lastAddRef.current < 500) return;
    lastAddRef.current = Date.now();

    const color = EMOTION_PRESETS[emotion] || getCustomEmotionColor(emotion) || stringToColor(emotion);
    
    // Randomized starting conditions
    const sphereData = {
      emotion,
      color,
      x: (Math.random() - 0.5) * 8,
      y: (Math.random() - 0.5) * 8,
      z: (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
      vz: (Math.random() - 0.5) * 0.8,
      size,
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, 'spheres'), sphereData);
      play(emotion);
      setCurrentEmotion(emotion);
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'spheres');
    }
  }, []);

  const handlePinch = useCallback((size: number) => {
    addSphere(currentEmotion, size);
  }, [addSphere, currentEmotion]);

  const handleLandmarks = useCallback((results: Results) => {
    setHandResults(results);
  }, []);

  if (!isReady) {
    return (
      <div className="w-full h-screen bg-[#050505] flex items-center justify-center text-white/20 uppercase tracking-[0.3em] text-sm">
        Connecting to the void...
      </div>
    );
  }

  return (
    <div className="w-full h-screen overflow-hidden relative flex flex-col bg-[#080808]">
      {/* Background Mesh Pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none bg-mesh z-0"></div>

      {/* Header Navigation */}
      <header className="absolute top-0 left-0 right-0 z-20 flex justify-between items-start p-10 pointer-events-none">
        <div className="flex flex-col">
          <p className="text-[10px] uppercase tracking-[0.3em] font-medium text-white/40">Cloud Mind</p>
        </div>
        <div className="flex gap-12 text-[11px] uppercase tracking-widest font-medium pointer-events-auto">
          {!user ? (
            <button 
              onClick={login}
              className="px-6 py-2 bg-white text-black rounded-full font-serif italic text-sm hover:bg-white/90 transition-colors shadow-xl"
            >
              Enter the Space
            </button>
          ) : (
            <>
              <div className="flex flex-col items-end">
                <span className="text-[#ff3e00]">Tracking Active</span>
                <span className="opacity-40">{user.displayName || 'Contributor'}</span>
              </div>
              <div className="w-px h-8 bg-white/20"></div>
              <div className="flex flex-col items-end">
                <span className="text-white">Live Experience</span>
                <span className="opacity-40">Rendering: WebGL 2.0</span>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Main Simulation Area */}
      <main className="absolute inset-0 z-10 overflow-hidden bg-black">
        <Experience isRunning={isRunning} handResults={handResults} />

        {user && (
          <div className="absolute top-24 bottom-8 left-10 z-[50] pointer-events-auto">
            <EmotionInput onAddSphere={addSphere} />
          </div>
        )}

        {!user && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px] z-20">
            <div className="text-center">
              <p className="text-white/40 text-xs uppercase tracking-[0.3em] mb-4">Awaiting presence</p>
              <button 
                onClick={login}
                className="px-8 py-3 bg-white text-black rounded-full font-serif italic text-lg hover:bg-white/90 transition-all hover:scale-105 shadow-2xl"
              >
                Sign in to participate
              </button>
            </div>
          </div>
        )}

        {/* Central Interaction Marker */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-20">
          <div className="w-[600px] h-[600px] border border-white/5 rounded-full flex items-center justify-center">
            <div className="w-[400px] h-[400px] border border-white/10 rounded-full flex items-center justify-center">
              <div className="w-1 h-1 bg-white/20 rounded-full"></div>
            </div>
          </div>
        </div>
        
        {user && <HandTracker onPinch={handlePinch} onLandmarks={handleLandmarks} />}

        <AnimatePresence>
          {showNotification && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 bg-white/10 backdrop-blur-md rounded-full border border-white/20 flex items-center gap-3 z-[60]"
            >
              <div 
                className="w-2 h-2 rounded-full animate-ping" 
                style={{ backgroundColor: EMOTION_PRESETS[currentEmotion] || stringToColor(currentEmotion) }}
              />
              <span className="text-white text-xs font-medium tracking-tight">
                Released <span className="italic opacity-70 px-1">{currentEmotion}</span> into the space
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Control Buttons */}
      <div className="fixed bottom-8 left-10 z-50 flex gap-4">
        {user && (
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-full transition-all backdrop-blur-md ${
              isRunning 
                ? 'bg-white/5 border-white/20 text-white hover:bg-white/10' 
                : 'bg-red-500/20 border-red-500/50 text-red-500 hover:bg-red-500/30'
            }`}
          >
            {isRunning ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
            <span className="text-[10px] uppercase tracking-widest font-medium">
              {isRunning ? 'System Running' : 'System Frozen'}
            </span>
          </button>
        )}
      </div>

      {/* Branding - Repositioned to bottom right */}
      <div className="absolute right-10 bottom-8 z-50 flex items-center gap-4 pointer-events-none">
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase tracking-[0.4em] text-white/30 font-medium leading-none">Cloud Mind</span>
          <span className="text-[9px] uppercase tracking-[0.2em] text-white/10 mt-1">Digital Ephemeral Architecture</span>
        </div>
        <div className="w-px h-6 bg-white/10"></div>
        <span className="text-[9px] text-white/20 font-mono tracking-tighter">V1.0.4.C</span>
      </div>
    </div>
  );
}

