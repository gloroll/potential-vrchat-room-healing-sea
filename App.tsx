import React, { useState, useCallback } from 'react';
import OceanEnvironment from './components/OceanEnvironment';
import HandTracker from './components/HandTracker';
import { HandData, GameState } from './types';

const App: React.FC = () => {
  const [handData, setHandData] = useState<HandData>({
    isDetected: false,
    position: { x: 0.5, y: 0.5 },
    directionVector: { x: 0, y: 0 }
  });

  const [gameState, setGameState] = useState<GameState>(GameState.NORMAL);
  const [msg, setMsg] = useState<string>("Use your index finger to guide the view");

  const handleHandUpdate = useCallback((data: HandData) => {
    setHandData(data);
  }, []);

  const triggerStorm = useCallback(() => {
    if (gameState === GameState.STORM) return;

    // Enter Storm Mode
    setGameState(GameState.STORM);
    setMsg("A STORM IS PASSING THROUGH...");

    // Lasts for 10 seconds, then returns to normal
    setTimeout(() => {
      setGameState(GameState.NORMAL);
      setMsg("The sky clears. Peace returns.");
      setTimeout(() => setMsg("Use your index finger to guide the view"), 4000);
    }, 10000);
  }, [gameState]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black select-none font-sans">
      
      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-0">
        <OceanEnvironment 
          handData={handData} 
          gameState={gameState} 
          onEventTrigger={triggerStorm} 
        />
      </div>

      {/* Hand Tracker UI (Camera) */}
      <HandTracker onUpdate={handleHandUpdate} />

      {/* UI Overlay */}
      <div className="absolute top-8 w-full text-center z-10 pointer-events-none">
        <h1 className="text-4xl font-light tracking-widest text-white/90 drop-shadow-lg mix-blend-overlay">
          HEALING OCEAN
        </h1>
        <p className="mt-2 text-white/80 text-sm transition-opacity duration-500">
          {msg}
        </p>
      </div>

      {/* Visual Indicator of Finger Direction */}
      {handData.isDetected && (
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2 z-10 opacity-70">
           <div className="relative w-20 h-20 border border-white/30 rounded-full flex items-center justify-center bg-white/5 backdrop-blur-sm">
              <div 
                className="w-4 h-4 bg-white rounded-full shadow-[0_0_10px_white] transition-transform duration-100"
                style={{
                  transform: `translate(${handData.directionVector.x * 30}px, ${handData.directionVector.y * 30}px)`
                }}
              />
           </div>
           <span className="text-xs text-white/50 uppercase tracking-widest">Navigation</span>
        </div>
      )}
      
      {/* Vignette Overlay for cinematic feel */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] z-20" />
      
      {/* Storm Overlay (Gray tint instead of blackout) */}
      <div 
        className={`absolute inset-0 pointer-events-none bg-slate-900 mix-blend-multiply transition-opacity duration-1000 z-30 ${gameState === GameState.STORM ? 'opacity-60' : 'opacity-0'}`} 
      />

    </div>
  );
};

export default App;
