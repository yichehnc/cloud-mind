import React, { useEffect, useState } from 'react';
import { collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db, auth, login } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

type Phase = 'idle' | 'clearing' | 'done' | 'error';

const ClearPage: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [deleted, setDeleted] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) login();
    });
    return () => unsub();
  }, []);

  const handleClear = async () => {
    setPhase('clearing');
    try {
      const snap = await getDocs(collection(db, 'spheres'));
      setTotal(snap.size);
      let count = 0;
      for (const doc of snap.docs) {
        try {
          await deleteDoc(doc.ref);
          count++;
          setDeleted(count);
        } catch {
          // Skip docs we don't own
        }
      }
      setPhase('done');
    } catch (e) {
      console.error(e);
      setPhase('error');
    }
  };

  return (
    <div className="w-full h-screen bg-[#080808] flex flex-col items-center justify-center gap-8 text-white">
      <div className="flex flex-col items-center gap-2">
        <p className="text-[10px] uppercase tracking-[0.4em] text-white/30 font-medium">Cloud Mind</p>
        <h1 className="text-2xl font-serif italic text-white/80">Void Clearance</h1>
      </div>

      {phase === 'idle' && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-white/40 text-xs uppercase tracking-[0.2em] text-center max-w-xs">
            This will permanently dissolve all spheres from the shared space.
          </p>
          <button
            onClick={handleClear}
            className="px-8 py-3 bg-white text-black rounded-full font-serif italic text-lg hover:bg-white/90 transition-all hover:scale-105 shadow-2xl"
          >
            Clear the void
          </button>
        </div>
      )}

      {phase === 'clearing' && (
        <div className="flex flex-col items-center gap-3">
          <div className="w-32 h-[1px] bg-white/10 overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-300"
              style={{ width: total ? `${(deleted / total) * 100}%` : '0%' }}
            />
          </div>
          <p className="text-white/30 text-[10px] uppercase tracking-widest">
            Dissolving {deleted} / {total}
          </p>
        </div>
      )}

      {phase === 'done' && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-white/60 text-xs uppercase tracking-[0.2em]">
            {deleted} sphere{deleted !== 1 ? 's' : ''} dissolved.
          </p>
          <button
            onClick={() => window.close()}
            className="px-6 py-2 border border-white/20 rounded-full text-white/50 text-xs uppercase tracking-widest hover:text-white hover:border-white/40 transition-all"
          >
            Close
          </button>
        </div>
      )}

      {phase === 'error' && (
        <p className="text-red-400 text-xs uppercase tracking-widest">Failed to access the void.</p>
      )}
    </div>
  );
};

export default ClearPage;
