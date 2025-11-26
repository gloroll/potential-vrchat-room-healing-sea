import React, { useRef, useMemo, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, extend, useThree, useLoader } from '@react-three/fiber';
import { Sky, Stars, Line } from '@react-three/drei';
import { 
  Vector3, 
  Points, 
  BufferAttribute, 
  MathUtils, 
  Color, 
  PointLight, 
  TextureLoader, 
  RepeatWrapping, 
  RGBAFormat, 
  PlaneGeometry, 
  ACESFilmicToneMapping, 
  SRGBColorSpace, 
  AdditiveBlending
} from 'three';
import { Water } from 'three-stdlib';
import { HandData, GameState } from '../types';

// Extend Three fiber with Water
extend({ Water });

interface OceanProps {
  handData: HandData;
  gameState: GameState;
  onEventTrigger: () => void;
}

// --- Visual Components ---

const Rain = () => {
  const count = 5000;
  
  // Create initial positions once
  const initialPositions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 800; // x spread
      pos[i * 3 + 1] = Math.random() * 400;     // y height
      pos[i * 3 + 2] = (Math.random() - 0.5) * 800; // z spread
    }
    return pos;
  }, []);

  const pointsRef = useRef<Points>(null);

  useFrame((state, delta) => {
    if (pointsRef.current && pointsRef.current.geometry) {
      const geo = pointsRef.current.geometry;
      const positionAttribute = geo.getAttribute('position') as BufferAttribute;
      const positions = positionAttribute.array as Float32Array;

      for (let i = 1; i < count * 3; i += 3) {
        positions[i] -= 150 * delta; // Rain fall speed
        if (positions[i] < 0) {
          positions[i] = 300; // Reset to top
        }
      }
      positionAttribute.needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={initialPositions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial 
        attach="material" 
        color={0xaaaaaa} 
        size={0.6} 
        transparent 
        opacity={0.5} 
        sizeAttenuation={true} 
        blending={AdditiveBlending}
      />
    </points>
  );
};

// Generates a random lightning bolt path
const createBoltPoints = (startPos: Vector3) => {
  const pts: Vector3[] = [];
  let current = startPos.clone();
  pts.push(current.clone());
  
  // Zigzag down
  while (current.y > 10) {
    const drop = Math.random() * 30 + 10;
    current.y -= drop;
    current.x += (Math.random() - 0.5) * 40;
    current.z += (Math.random() - 0.5) * 40;
    pts.push(current.clone());

    // Chance to branch (simplified: just erratic movement)
    if (Math.random() > 0.7) {
       current.x += (Math.random() - 0.5) * 50;
    }
  }
  return pts;
};

const LightningBolt: React.FC<{ position: Vector3 }> = ({ position }) => {
  const points = useMemo(() => createBoltPoints(position), [position]);

  return (
    <Line 
      points={points} 
      color="white" 
      lineWidth={4} 
    />
  );
};

// Controls random lighting flashes
const LightningSystem: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const { scene } = useThree();
  const [activeBolt, setActiveBolt] = useState<Vector3 | null>(null);
  const nextFlashTime = useRef(0);
  const flashIntensity = useRef(0);
  const lightRef = useRef<PointLight>(null);

  useFrame((state, delta) => {
    if (!enabled) {
      if (activeBolt) setActiveBolt(null);
      flashIntensity.current = 0;
      if (lightRef.current) lightRef.current.intensity = 0;
      return;
    }

    // Timer logic
    if (state.clock.elapsedTime > nextFlashTime.current) {
      // Trigger Flash
      const x = (Math.random() - 0.5) * 800;
      const z = (Math.random() - 0.5) * 800 - 200; // Mostly in front
      setActiveBolt(new Vector3(x, 300, z));
      
      flashIntensity.current = 2.0; // Start bright
      
      // Schedule next flash (random 0.5s to 3s)
      nextFlashTime.current = state.clock.elapsedTime + Math.random() * 2.5 + 0.5;
      
      // Bolt only lasts briefly
      setTimeout(() => setActiveBolt(null), 150); 
    }

    // Decay flash intensity
    flashIntensity.current = MathUtils.lerp(flashIntensity.current, 0, delta * 5);
    
    // Apply flash lighting to scene
    if (lightRef.current) {
      lightRef.current.intensity = flashIntensity.current * 10; // Multiplier for drama
      lightRef.current.position.set(activeBolt?.x || 0, 400, activeBolt?.z || 0);
    }
    
    // Optional: Flash background sky slightly
    scene.background = new Color(enabled ? 0x111118 : 0x000000).lerp(new Color(0x444455), flashIntensity.current * 0.3);
  });

  return (
    <>
      <pointLight ref={lightRef} distance={2000} decay={2} color="#ccddff" />
      {activeBolt && <LightningBolt position={activeBolt} />}
    </>
  );
};

const OceanMesh: React.FC<{ gameState: GameState }> = ({ gameState }) => {
  const ref = useRef<any>();
  const gl = useThree((state) => state.gl);
  
  // Use a stable texture URL. Standard three.js example texture.
  const waterNormals = useLoader(TextureLoader, 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/water/Water_1_M_Normal.jpg');
  
  useEffect(() => {
    if (waterNormals) {
      waterNormals.wrapS = waterNormals.wrapT = RepeatWrapping;
    }
  }, [waterNormals]);

  const waterConfig = useMemo(
    () => ({
      textureWidth: 512,
      textureHeight: 512,
      waterNormals,
      sunDirection: new Vector3(),
      sunColor: 0xffffff,
      waterColor: 0x001e0f, // RESTORED: Deep, calm healing teal/black
      distortionScale: 3.7, // RESTORED: Softer waves
      fog: true,
      format: RGBAFormat,
    }),
    [waterNormals]
  );

  const geom = useMemo(() => new PlaneGeometry(30000, 30000), []);

  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.material.uniforms.time.value += delta * 0.5;
      
      // Increase turbulence during storm, but keep base calm
      const baseDistortion = 3.7;
      const stormDistortion = 8.0; 
      const targetDistortion = gameState === GameState.STORM ? stormDistortion : baseDistortion;
      
      ref.current.material.uniforms.distortionScale.value = MathUtils.lerp(
        ref.current.material.uniforms.distortionScale.value,
        targetDistortion,
        delta
      );
    }
  });

  return (
    // @ts-ignore
    <water
      ref={ref}
      args={[geom, waterConfig]}
      rotation-x={-Math.PI / 2}
    />
  );
};

const SceneController: React.FC<{ handData: HandData; onEventTrigger: () => void }> = ({ handData, onEventTrigger }) => {
  const { camera } = useThree();
  const moveDurationRef = useRef(0);
  const velocity = useRef(new Vector3());
  
  const SPEED = 15.0; 
  const EVENT_THRESHOLD_SECONDS = 10;

  useFrame((state, delta) => {
    const targetVelocity = new Vector3();
    let isMoving = false;

    if (handData.isDetected) {
      const deadzone = 0.15;
      const mag = Math.sqrt(handData.directionVector.x ** 2 + handData.directionVector.y ** 2);
      
      if (mag > deadzone) {
        targetVelocity.x = handData.directionVector.x * SPEED;
        targetVelocity.z = handData.directionVector.y * SPEED; 
        isMoving = true;
      }
    }

    if (isMoving) {
      moveDurationRef.current += delta;
      if (moveDurationRef.current > EVENT_THRESHOLD_SECONDS) {
        onEventTrigger();
        moveDurationRef.current = 0; 
      }
    } else {
      moveDurationRef.current = Math.max(0, moveDurationRef.current - delta * 2);
    }

    velocity.current.x += (targetVelocity.x - velocity.current.x) * 0.05;
    velocity.current.z += (targetVelocity.z - velocity.current.z) * 0.05;

    camera.position.x += velocity.current.x * delta;
    camera.position.z += velocity.current.z * delta;
    camera.position.y = 10;
  });

  return null;
};

const Lighting = ({ gameState }: { gameState: GameState }) => {
  const isStorm = gameState === GameState.STORM;

  return (
    <>
      <ambientLight intensity={isStorm ? 0.3 : 0.8} color={isStorm ? "#222233" : "#ffffff"} />
      
      {/* Sun Light - dims during storm */}
      <directionalLight 
        position={[300, 100, -500]} 
        intensity={isStorm ? 0.2 : 1.5} 
        color={isStorm ? "#445566" : "#ffaa77"} 
      />
    </>
  );
};

const OceanEnvironment: React.FC<OceanProps> = ({ handData, gameState, onEventTrigger }) => {
  return (
    <Canvas
      camera={{ position: [0, 10, 100], fov: 55, near: 1, far: 20000 }}
      gl={{ toneMapping: ACESFilmicToneMapping, outputColorSpace: SRGBColorSpace }}
    >
      <SceneController handData={handData} onEventTrigger={onEventTrigger} />
      
      {/* Suspense is crucial for textures loaded via useLoader to not block the whole app */}
      <Suspense fallback={null}>
        <OceanMesh gameState={gameState} />
      </Suspense>
      
      {gameState === GameState.STORM && <Rain />}
      <LightningSystem enabled={gameState === GameState.STORM} />
      
      <Sky
        distance={450000}
        sunPosition={[300, 10, -500]}
        inclination={0}
        azimuth={0.25}
        turbidity={gameState === GameState.STORM ? 15 : 8}
        rayleigh={gameState === GameState.STORM ? 0.5 : 3}
        mieCoefficient={0.005}
        mieDirectionalG={0.7}
      />
      
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

      <Lighting gameState={gameState} />
    </Canvas>
  );
};

export default OceanEnvironment;