import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PARTICLES_PER_LINK, PARTICLE_BASE_SPEED, PARTICLE_RADIUS } from './schematic.constants';
import type { PipelineLink, PipelineNode } from './schematic.types';

export interface DataParticleStreamProps {
  from: PipelineNode;
  to: PipelineNode;
  link: PipelineLink;
}

interface ParticleSeed {
  offset: number;
  speed: number;
}

export function DataParticleStream({ from, to, link }: DataParticleStreamProps) {
  const seeds = useMemo<ReadonlyArray<ParticleSeed>>(
    () =>
      Array.from({ length: PARTICLES_PER_LINK }, (_, i) => ({
        offset: i / PARTICLES_PER_LINK,
        speed: PARTICLE_BASE_SPEED * (0.8 + (i % 3) * 0.15),
      })),
    [],
  );

  const curve = useMemo(() => buildCurve(from.position, to.position), [from.position, to.position]);

  const points = useMemo(() => curve.getPoints(60), [curve]);
  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [points]);

  return (
    <group>
      <line>
        <primitive object={lineGeometry} attach="geometry" />
        <lineBasicMaterial color={from.color} transparent opacity={0.18} />
      </line>
      {seeds.map((seed, idx) => (
        <Particle key={`${link.from}-${link.to}-${idx}`} curve={curve} seed={seed} color={from.color} />
      ))}
    </group>
  );
}

function Particle({
  curve,
  seed,
  color,
}: {
  curve: THREE.QuadraticBezierCurve3;
  seed: ParticleSeed;
  color: string;
}) {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFrame(({ clock }) => {
    if (meshRef.current === null) return;
    const t = ((clock.getElapsedTime() * seed.speed + seed.offset) % 1);
    const p = curve.getPoint(t);
    meshRef.current.position.set(p.x, p.y, p.z);
    const scale = 0.8 + Math.sin(t * Math.PI) * 0.4;
    meshRef.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[PARTICLE_RADIUS, 12, 12]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

function buildCurve(
  from: Readonly<[number, number, number]>,
  to: Readonly<[number, number, number]>,
): THREE.QuadraticBezierCurve3 {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const mid = start.clone().add(end).multiplyScalar(0.5);
  mid.y += 0.4 + Math.abs(end.x - start.x) * 0.1;
  mid.z += 0.1;
  return new THREE.QuadraticBezierCurve3(start, mid, end);
}
