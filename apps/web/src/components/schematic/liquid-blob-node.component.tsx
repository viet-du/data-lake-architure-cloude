import { useTranslation } from 'react-i18next';
import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial } from '@react-three/drei';
import { CanvasTexture, SRGBColorSpace, type Group } from 'three';
import type { PipelineNode } from './schematic.types';

export interface LiquidBlobNodeProps {
  node: PipelineNode;
  active: boolean;
  onSelect: (kind: PipelineNode['kind']) => void;
}

export function LiquidBlobNode({ node, active, onSelect }: LiquidBlobNodeProps) {
  const { t } = useTranslation();
  const label = t(node.labelKey);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas text rendering is unavailable');
    context.fillStyle = '#0f172a';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = '36px system-ui, sans-serif';
    context.fillStyle = '#e2e8f0';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label, canvas.width / 2, canvas.height / 2, canvas.width - 24);
    const value = new CanvasTexture(canvas);
    value.colorSpace = SRGBColorSpace;
    return value;
  }, [label]);
  useEffect(() => () => texture.dispose(), [texture]);
  const groupRef = useRef<Group | null>(null);

  useFrame(({ clock }) => {
    if (groupRef.current === null) return;
    const t = clock.getElapsedTime();
    groupRef.current.position.y = node.position[1] + Math.sin(t * 0.6 + node.position[0]) * 0.08;
  });

  const emissive = useMemo(() => (active ? 0.6 : 0.25), [active]);

  return (
    <Float
      speed={active ? 1.2 : 0.6}
      rotationIntensity={active ? 0.8 : 0.3}
      floatIntensity={active ? 1.1 : 0.4}
    >
      <group
        ref={groupRef}
        position={node.position}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(node.kind);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          if (typeof document !== 'undefined') document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          if (typeof document !== 'undefined') document.body.style.cursor = 'auto';
        }}
      >
        <mesh>
          <sphereGeometry args={[0.55, 64, 64]} />
          <MeshDistortMaterial
            color={node.color}
            attach="material"
            distort={active ? 0.55 : 0.35}
            speed={active ? 1.6 : 0.8}
            roughness={0.2}
            metalness={0.1}
            emissive={node.glow}
            emissiveIntensity={emissive}
          />
        </mesh>
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.72, 0.8, 64]} />
          <meshBasicMaterial color={node.glow} transparent opacity={active ? 0.7 : 0.35} />
        </mesh>
        <sprite position={[0, -0.95, 0]} scale={[2.2, 0.33, 1]}>
          <spriteMaterial map={texture} depthWrite={false} />
        </sprite>
      </group>
    </Float>
  );
}
