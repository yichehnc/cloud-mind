# Cloud Mind: Digital Ephemeral Architecture

**Cloud Mind** is an interactive, kinetic art installation designed to translate human emotion into a shared digital space. By bridging the gap between tactile physical gestures and abstract emotional states, it creates a meditative environment where users can visualize, release, and connect through their internal experiences.

## 🎨 The Concept: Emotional Release as Art

In "Cloud Mind," emotions are no longer invisible. They take the form of colored spheres—ethereal, buoyant objects that populate a shared 3D void. 

Users interact with the space using **hand gestures**. By performing a "pinch" gesture, a user captures an emotion and releases it into the collective field. Each sphere's color reflects a specific emotional state (e.g., Happy, Calm, Anxious, Creative), and its movement is guided by physics and local interactions.

## 🧠 Mental Health Awareness & Connection

The project is rooted in the philosophy that **visualizing emotion is a step toward understanding it**. 

- **Externalization**: By selecting an emotion and physically "releasing" it into the environment, users engage in a symbolic act of letting go. This externalization can be therapeutic, helping to reduce the weight of internal feelings.
- **Shared Collective**: Because the space is persistent and shared, users see the "emotional spheres" of others floating alongside their own. This serves as a powerful reminder that we are not alone in our feelings; our joy, anxiety, and creativity exist within a larger, connected human tapestry.
- **Mindful Interaction**: The use of kinetic hand tracking requires focus and presence, grounding the user in the moment and providing a calming, tactile loop that bridges the gap between the physical and digital worlds.

## 🛠️ Tech Stack

Cloud Mind was built using a modern, high-performance stack to ensure a seamless, immersive experience:

*   **Core**: [React 19](https://react.dev/) & [Vite](https://vitejs.dev/) - Providing a lightning-fast, reactive framework for the application logic.
*   **3D Environment**: [Three.js](https://threejs.org/) via [`@react-three/fiber`](https://docs.pmnd.rs/react-three-fiber/) - Powering the immersive WebGL 2.0 visualization with a declarative, component-based approach.
*   **Hand Tracking**: [MediaPipe Hands](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker) - Utilizing advanced computer vision to enable controller-free, kinetic interaction through the webcam.
*   **Real-time Persistence**: [Firebase (Firestore)](https://firebase.google.com/) - Synchronizing emotional data across all users in real-time, creating a persistent, living collective space.
*   **Styling & Motion**: [Tailwind CSS](https://tailwindcss.com/) & [Motion (Framer Motion)](https://motion.dev/) - Crafting a minimal, high-aesthetic UI with fluid, meaningful transitions.

---

*Cloud Mind is a digital laboratory exploring the intersection of technology, art, and human connection.*
