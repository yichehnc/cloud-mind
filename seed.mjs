import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const config = {
  projectId: 'gen-lang-client-0635979159',
  appId: '1:367410175747:web:cc1ce90f9780e3983a5336',
  apiKey: 'AIzaSyAsaXsZLqL-xhZ2o2avLzWHfByf9xj17O0',
  authDomain: 'gen-lang-client-0635979159.firebaseapp.com',
  storageBucket: 'gen-lang-client-0635979159.firebasestorage.app',
  messagingSenderId: '367410175747',
};
const DB_ID = 'ai-studio-637478b4-bd44-4be1-a04f-0eb1b83b79b1';
const SEED_USER_ID = 'seed';

const EMOTIONS = [
  { name: 'Happy',     color: '#eab308' },
  { name: 'Joyful',    color: '#ff0000' },
  { name: 'Anger',     color: '#7f1d1d' },
  { name: 'Calm',      color: '#3b82f6' },
  { name: 'Anxiety',   color: '#f97316' },
  { name: 'Jealous',   color: '#22c55e' },
  { name: 'Love',      color: '#ec4899' },
  { name: 'Melancholy',color: '#7e22ce' },
  { name: 'Fear',      color: '#4338ca' },
  { name: 'Awe',       color: '#06b6d4' },
];

const app = initializeApp(config);
const db = getFirestore(app, DB_ID);
const auth = getAuth(app);

console.log('Signing in anonymously...');
const { user } = await signInAnonymously(auth);
const uid = user.uid;
console.log(`Signed in as ${uid}. Seeding...`);

let inserted = 0;
for (const { name, color } of EMOTIONS) {
  for (let i = 0; i < 30; i++) {
    const doc = {
      emotion: name,
      color,
      x: (Math.random() - 0.5) * 14,
      y: (Math.random() - 0.5) * 14,
      z: (Math.random() - 0.5) * 14,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      vz: (Math.random() - 0.5) * 0.6,
      size: 0.3 + Math.random() * 0.7,
      userId: uid,
      createdAt: Timestamp.now(),
    };
    await addDoc(collection(db, 'spheres'), doc);
    inserted++;
    process.stdout.write(`\r${inserted}/300 inserted`);
  }
}
console.log('\nDone.');
process.exit(0);
