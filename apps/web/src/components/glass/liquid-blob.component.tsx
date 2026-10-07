import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { MeshDistortMaterial, MeshTransmissionMaterial, Float } from '@react-three/drei';

export type ELiquidBlobColor = 'primary' | 'bronze' | 'silver' | 'gold' | 'mixed';

export interface LiquidBlobProps {
  color?: ELiquidBlobColor;
  height?: string | number;
  speed?: number;
  distort?: number;
  transmission?: boolean;
  className?: string;
  paused?: boolean;
}

const COLOR_MAP: Readonly<Record<ELiquidBlobColor, string>> = {
  primary: '#6366f1',
  bronze: '#f59e0b',
  silver: '#94a3b8',
  gold: '#eab308',
  mixed: '#a78bfa',
};

function BlobMesh({
  color,
  speed,
  distort,
  transmission,
  paused,
}: {
  color: string;
  speed: number;
  distort: number;
  transmission: boolean;
  paused: boolean;
}) {
  return (
    <Float
      speed={paused ? 0 : speed}
      rotationIntensity={paused ? 0 : 0.6}
      floatIntensity={paused ? 0 : 0.8}
    >
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        {transmission ? (
          <MeshTransmissionMaterial
            color={color}
            thickness={0.4}
            roughness={0.05}
            transmission={1}
            ior={1.2}
            chromaticAberration={0.06}
            backside
          />
        ) : (
          <MeshDistortMaterial
            color={color}
            attach="material"
            distort={distort}
            speed={speed}
            roughness={0.2}
            metalness={0.1}
          />
        )}
      </mesh>
    </Float>
  );
}

export function LiquidBlob({
  color = 'primary',
  height = 320,
  speed = 1.5,
  distort = 0.45,
  transmission = false,
  className,
  paused = false,
}: LiquidBlobProps) {
  const colorValue = COLOR_MAP[color];

  return (
    <div
      className={className}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        width: '100%',
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 4], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 2, 3]} intensity={1.2} color="#ffffff" />
        <directionalLight position={[-2, -1, 2]} intensity={0.4} color="#a78bfa" />
        <Suspense fallback={null}>
          <BlobMesh
            color={colorValue}
            speed={speed}
            distort={distort}
            transmission={transmission}
            paused={paused}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
