import React, { useRef, useMemo, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, extend, useThree, Object3DNode } from '@react-three/fiber';
import { Sky, Stars, Line, Environment, useTexture, Loader } from '@react-three/drei';
import { 
  Vector3, 
  Color, 
  MathUtils, 
  PlaneGeometry, 
  RepeatWrapping, 
  SRGBColorSpace, 
  RGBAFormat, 
  ACESFilmicToneMapping,
  AdditiveBlending,
  Points,
  BufferAttribute
} from 'three';
import { Water } from 'three-stdlib';
import { HandData, GameState } from '../types';

// Extend Three fiber with Water
extend({ Water });

// Add type definition for the water component to fix JSX error
declare module '@react-three/fiber' {
  interface ThreeElements {
    water: Object3DNode<Water, typeof Water>;
  }
}

interface OceanProps {
  handData: HandData;
  gameState: GameState;
  onEventTrigger: () => void;
}

// --- Utility Components ---

// Error Boundary for texture loading
class TextureErrorBoundary extends React.Component<{ fallback: React.ReactNode, children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { fallback: React.ReactNode, children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
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
        color="#aaaaaa"
        size={0.8}
        transparent
        opacity={0.6}
        sizeAttenuation
        blending={AdditiveBlending}
      />
    </points>
  );
};

const LightningBolt = () => {
  const points = useMemo(() => {
    const pts = [];
    let x = (Math.random() - 0.5) * 600;
    let y = 300;
    let z = (Math.random() - 0.5) * 400 - 200; // Background
    
    pts.push(new Vector3(x, y, z));
    
    let segments = 15;
    for(let i=0; i<segments; i++) {
      x += (Math.random() - 0.5) * 30;
      y -= 20 + Math.random() * 20;
      z += (Math.random() - 0.5) * 30;
      pts.push(new Vector3(x, y, z));
    }
    return pts;
  }, []);

  return (
    <Line
      points={points}
      color="white"
      lineWidth={5}
      // transparent prop removed to fix type error, opacity usually works with LineMaterial if allowed or default
      opacity={0.9}
    />
  );
};

const LightningSystem = ({ active }: { active: boolean }) => {
  const [flash, setFlash] = useState(false);
  const [bolt, setBolt] = useState(false);
  const { scene } = useThree();
  
  useEffect(() => {
    if (!active) {
      setFlash(false);
      setBolt(false);
      scene.background = new Color('#000000');
      return;
    }

    let timeoutId: NodeJS.Timeout;

    const triggerLightning = () => {
      // Show bolt
      setBolt(true);
      // Flash screen white
      setFlash(true);
      scene.background = new Color('#333344');

      // Hide flash quickly
      setTimeout(() => {
        setFlash(false);
        scene.background = new Color('#050505');
      }, 100);

      // Hide bolt shortly after
      setTimeout(() => {
        setBolt(false);
      }, 300);

      // Schedule next
      const nextDelay = Math.random() * 2000 + 1000; // 1-3 seconds
      timeoutId = setTimeout(triggerLightning, nextDelay);
    };

    timeoutId = setTimeout(triggerLightning, Math.random() * 1000);

    return () => clearTimeout(timeoutId);
  }, [active, scene]);

  return (
    <>
      {bolt && <LightningBolt />}
      {flash && <ambientLight intensity={5} color="white" />}
    </>
  );
};

// Simple Fallback Ocean Component (No texture needed)
const FallbackOcean = () => (
  <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
    <planeGeometry args={[10000, 10000]} />
    <meshStandardMaterial color="#004466" roughness={0.1} metalness={0.5} />
  </mesh>
);

const OceanMesh = ({ gameState }: { gameState: GameState }) => {
  const ref = useRef<any>(null);
  const gl = useThree((state) => state.gl);
  
  // Load texture safely within Suspense
  const waterNormals = useTexture(
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/water/Water_1_M_Normal.jpg'
  );

  waterNormals.wrapS = waterNormals.wrapT = RepeatWrapping;

  // Memoize geometry to prevent recreation
  const geom = useMemo(() => new PlaneGeometry(10000, 10000), []);

  const config = useMemo(
    () => ({
      textureWidth: 512,
      textureHeight: 512,
      waterNormals,
      sunDirection: new Vector3(),
      sunColor: 0xffffff,
      waterColor: 0x004466, // Healing Teal
      distortionScale: 3.7,
      fog: false,
      format: gl.outputColorSpace === SRGBColorSpace ? RGBAFormat : undefined,
    }),
    [waterNormals, gl.outputColorSpace]
  );

  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.material.uniforms.time.value += delta * 0.5;
      
      // Dynamic adjustments based on GameState
      const isStorm = gameState === GameState.STORM;
      const targetDistortion = isStorm ? 8.0 : 3.7;
      // const targetColor = isStorm ? new Color("#001e33") : new Color("#004466");
      
      // Lerp distortion
      ref.current.material.uniforms.distortionScale.value = MathUtils.lerp(
        ref.current.material.uniforms.distortionScale.value,
        targetDistortion,
        delta * 0.5
      );

      // Lerp Color (Manual access to uniform if exposed, otherwise handled by re-render prop)
      // Note: Water shader uniforms are tricky to update dynamically for color without deeper access,
      // so we rely on prop updates mostly, or simple visual changes via lighting.
    }
  });

  return (
    <water 
      ref={ref} 
      args={[geom, config]} 
      rotation-x={-Math.PI / 2} 
    />
  );
};

const SceneContent: React.FC<OceanProps> = ({ handData, gameState, onEventTrigger }) => {
  const { camera } = useThree();
  const movementRef = useRef(0); // Track continuous movement duration
  const lastDirRef = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    // 1. Camera Movement Logic
    const speed = 0.5;
    const targetX = handData.isDetected ? handData.directionVector.x * 20 : 0;
    const targetY = handData.isDetected ? 10 + handData.directionVector.y * 10 : 10;
    
    // Smooth LookAt
    const lookAtVec = new Vector3(targetX, targetY, -50);
    const currentLook = new Vector3();
    camera.getWorldDirection(currentLook);
    
    // Simple pan logic
    camera.position.x += (handData.directionVector.x * 10 - camera.position.x) * delta * speed;
    camera.position.y += (handData.directionVector.y * 5 + 10 - camera.position.y) * delta * speed;
    camera.lookAt(lookAtVec);

    // 2. Storm Trigger Logic
    if (handData.isDetected) {
      // Check if moving significantly
      const isMoving = Math.abs(handData.directionVector.x) > 0.2 || Math.abs(handData.directionVector.y) > 0.2;
      
      if (isMoving) {
        movementRef.current += delta;
      } else {
        movementRef.current = Math.max(0, movementRef.current - delta);
      }

      if (movementRef.current > 10 && gameState === GameState.NORMAL) {
        onEventTrigger();
        movementRef.current = 0; // Reset
      }
    }
  });

  const isStorm = gameState === GameState.STORM;

  return (
    <>
      <ambientLight intensity={isStorm ? 0.2 : 0.8} />
      <pointLight position={[100, 100, 100]} intensity={isStorm ? 0.5 : 1.5} />
      <pointLight position={[-100, -100, -100]} intensity={0.5} />

      {/* Environment for Reflections */}
      <Environment preset="sunset" />

      {/* Sky & Atmosphere */}
      {!isStorm && (
        <Sky
          distance={450000}
          sunPosition={[100, 20, 100]}
          inclination={0}
          azimuth={0.25}
          turbidity={8}
          rayleigh={2}
        />
      )}
      
      {/* Stars appear when dark/stormy */}
      <Stars 
        radius={100} 
        depth={50} 
        count={5000} 
        factor={4} 
        saturation={0} 
        fade 
        speed={1} 
      />

      {/* Ocean Surface */}
      <TextureErrorBoundary fallback={<FallbackOcean />}>
        <Suspense fallback={<FallbackOcean />}>
          <OceanMesh gameState={gameState} />
        </Suspense>
      </TextureErrorBoundary>

      {/* Storm Effects */}
      {isStorm && <Rain />}
      <LightningSystem active={isStorm} />
    </>
  );
};

const OceanEnvironment: React.FC<OceanProps> = (props) => {
  return (
    <>
      <Canvas
        camera={{ position: [0, 10, 100], fov: 55 }}
        gl={{ 
          antialias: true,
          toneMapping: ACESFilmicToneMapping,
          outputColorSpace: SRGBColorSpace 
        }}
        dpr={[1, 2]} // Optimization for varying screen densities
      >
        <SceneContent {...props} />
      </Canvas>
      <Loader /> {/* Visual loading indicator for textures */}
    </>
  );
};

export default OceanEnvironment;