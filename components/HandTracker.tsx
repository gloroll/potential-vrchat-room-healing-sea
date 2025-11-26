import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { HandData } from '../types';

interface HandTrackerProps {
  onUpdate: (data: HandData) => void;
}

const HandTracker: React.FC<HandTrackerProps> = ({ onUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const lastVideoTimeRef = useRef<number>(-1);
  const requestRef = useRef<number>(0);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);

  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        
        startWebcam();
      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
      }
    };

    const startWebcam = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: 640,
              height: 480,
              facingMode: "user"
            }
          });
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.addEventListener("loadeddata", predictWebcam);
            setLoaded(true);
          }
        } catch (err) {
          console.error("Error accessing webcam:", err);
        }
      }
    };

    initMediaPipe();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const predictWebcam = () => {
    if (!handLandmarkerRef.current || !videoRef.current) return;

    const startTimeMs = performance.now();
    
    if (videoRef.current.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = videoRef.current.currentTime;
      const detections = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);

      if (detections.landmarks && detections.landmarks.length > 0) {
        // Get Index Finger Tip (Index 8)
        const landmarks = detections.landmarks[0];
        const indexTip = landmarks[8];
        
        // Mirror X because webcam is mirrored
        const x = 1 - indexTip.x;
        const y = indexTip.y;

        // Calculate vector from center (0.5, 0.5)
        const dirX = (x - 0.5) * 2; // Range -1 to 1
        const dirY = (y - 0.5) * 2; // Range -1 to 1

        onUpdate({
          isDetected: true,
          position: { x, y },
          directionVector: { x: dirX, y: dirY }
        });
      } else {
        onUpdate({
          isDetected: false,
          position: { x: 0.5, y: 0.5 },
          directionVector: { x: 0, y: 0 }
        });
      }
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  return (
    <div className="absolute top-4 left-4 z-50 pointer-events-none opacity-80">
      <div className="relative rounded-xl overflow-hidden shadow-lg border-2 border-white/20">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-32 h-24 object-cover transform scale-x-[-1] ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white text-xs">
            Loading AI...
          </div>
        )}
        {loaded && (
          <div className="absolute bottom-0 w-full bg-black/50 text-white text-[10px] text-center py-1">
             Show Hand to Move
          </div>
        )}
      </div>
    </div>
  );
};

export default HandTracker;