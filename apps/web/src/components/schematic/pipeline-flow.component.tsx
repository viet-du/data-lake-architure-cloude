import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  PIPELINE_LINKS,
  PIPELINE_NODES,
  SCHEMATIC_BACKGROUND_RING_RADIUS,
  SCHEMATIC_BACKGROUND_RING_TUBULAR,
} from './schematic.constants';
import { LiquidBlobNode } from './liquid-blob-node.component';
import { DataParticleStream } from './data-particle.component';
import type { EPipelineNodeKind } from './schematic.types';

export interface PipelineFlowProps {
  activeKind: EPipelineNodeKind | null;
  onSelect: (kind: EPipelineNodeKind) => void;
}

export function PipelineFlow({ activeKind, onSelect }: PipelineFlowProps) {
  return (
    <Canvas
      camera={{ position: [0, 2, 9], fov: 50 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <color attach="background" args={['#0a0a16']} />
      <fog attach="fog" args={['#0a0a16', 10, 24]} />

      <ambientLight intensity={0.45} />
      <directionalLight position={[3, 4, 4]} intensity={0.9} color="#a78bfa" />
      <directionalLight position={[-3, -2, 3]} intensity={0.55} color="#22d3ee" />
      <pointLight position={[0, 3, 2]} intensity={0.7} color="#f0abfc" />

      <Suspense fallback={null}>
        <BackgroundRing />
        {PIPELINE_NODES.map((node) => (
          <LiquidBlobNode
            key={node.kind}
            node={node}
            active={activeKind === node.kind}
            onSelect={onSelect}
          />
        ))}
        {PIPELINE_LINKS.map((link) => {
          const from = PIPELINE_NODES.find((n) => n.kind === link.from);
          const to = PIPELINE_NODES.find((n) => n.kind === link.to);
          if (from === undefined || to === undefined) return null;
          return <DataParticleStream key={`${link.from}-${link.to}`} from={from} to={to} link={link} />;
        })}
      </Suspense>

      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={5}
        maxDistance={14}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 1.7}
        autoRotate
        autoRotateSpeed={0.4}
      />
    </Canvas>
  );
}

function BackgroundRing() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[SCHEMATIC_BACKGROUND_RING_RADIUS, 0.04, 16, SCHEMATIC_BACKGROUND_RING_TUBULAR]} />
      <meshBasicMaterial color="#1e293b" transparent opacity={0.6} />
    </mesh>
  );
}
