import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Stars, Line } from '@react-three/drei';
import * as THREE from 'three';

interface GameSceneProps {
  speed: number;
  steering: number;
  onScore: (type: 'light' | 'pineapple') => void;
  onCrash: () => void;
  onTerrainChange: (type: 'road' | 'grass') => void;
}

// -- Assets & Components --

const FerrariDream = ({ steering, speed }: { steering: number, speed: number }) => {
  const group = useRef<THREE.Group>(null);
  const wheelRotRef = useRef(0);
  const frontWheelRefL = useRef<THREE.Group>(null);
  const frontWheelRefR = useRef<THREE.Group>(null);
  
  useFrame((state, delta) => {
    if (group.current) {
        // Realistic Yaw (Body turns into the curve slightly)
        // Reduced rotation for stability
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, -steering * 0.1, delta * 3);
        
        // Acceleration pitch
        const pitch = speed > 5 ? -0.02 * (speed / 100) : 0;
        group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, pitch, delta * 2);
    }

    // Steering - Front Wheels turn left/right
    if (frontWheelRefL.current && frontWheelRefR.current) {
         const targetSteer = -steering * 0.5; // Max 0.5 radians (reduced from 0.6)
         frontWheelRefL.current.rotation.y = THREE.MathUtils.lerp(frontWheelRefL.current.rotation.y, targetSteer, delta * 10);
         frontWheelRefR.current.rotation.y = THREE.MathUtils.lerp(frontWheelRefR.current.rotation.y, targetSteer, delta * 10);
    }

    wheelRotRef.current -= (speed / 6) * delta;
  });

  const paintBody = new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.5, metalness: 0.6 }); 
  const glass = new THREE.MeshPhysicalMaterial({ color: '#cffafe', roughness: 0.1, transmission: 0.9, thickness: 1 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#1f2937' });

  const Wheel = ({ x, z, isFront = false, forwardRef }: { x: number, z: number, isFront?: boolean, forwardRef?: any }) => (
      <group position={[x, 0.35, z]} ref={forwardRef}>
          <group rotation={[wheelRotRef.current, 0, 0]}>
            <mesh rotation={[0, 0, Math.PI/2]}>
                <cylinderGeometry args={[0.33, 0.33, 0.25, 24]} />
                <primitive object={wheelMat} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI/2]}>
                <cylinderGeometry args={[0.2, 0.2, 0.26, 8]} />
                <meshBasicMaterial color="#fcd34d" />
            </mesh>
          </group>
      </group>
  );

  return (
    <group ref={group}>
        <group>
            {/* Main Chassis */}
            <mesh position={[0, 0.6, 0]} material={paintBody} castShadow receiveShadow>
                <boxGeometry args={[1.8, 0.5, 4]} />
            </mesh>
            {/* Cabin */}
            <mesh position={[0, 1.1, -0.2]} material={glass}>
                 <boxGeometry args={[1.5, 0.6, 2.2]} />
            </mesh>
            {/* Spoiler */}
            <mesh position={[0, 0.9, 2.3]} rotation={[0.1, 0, 0]} material={paintBody}>
                <boxGeometry args={[1.9, 0.1, 0.5]} />
            </mesh>
            {/* Nose */}
            <mesh position={[0, 0.4, -2.1]} rotation={[0.2, 0, 0]} material={paintBody}>
                <boxGeometry args={[1.7, 0.3, 0.8]} />
            </mesh>
        </group>
        
        {/* Wheels */}
        <Wheel x={-0.95} z={1.3} />
        <Wheel x={0.95} z={1.3} />
        <Wheel x={-1.0} z={-1.3} isFront={true} forwardRef={frontWheelRefL} />
        <Wheel x={1.0} z={-1.3} isFront={true} forwardRef={frontWheelRefR} />
    </group>
  );
};

// -- Item System --

interface ItemData {
    id: number;
    type: 'light' | 'pineapple' | 'tree';
    x: number; // Absolute World X (0 is center of road)
    z: number;
    active: boolean;
    scaleVar: number;
}

const PineappleMesh = () => {
    // Improved "Real" Pineapple with spiky leaves
    return (
        <group scale={[6, 6, 6]} position={[0, 2.5, 0]}>
            {/* Body - Dodecahedron approximation for bumpy texture + color */}
             <mesh position={[0, 0, 0]}>
                <capsuleGeometry args={[0.45, 0.9, 4, 12]} />
                <meshStandardMaterial color="#eab308" roughness={0.6} bumpScale={0.1} />
            </mesh>
            
            {/* Geometric bumps */}
            <group>
               {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                   <mesh key={i} position={[Math.sin(i)*0.4, (i/2 - 1.5)*0.3, Math.cos(i)*0.4]} rotation={[Math.random(),i,Math.random()]}>
                       <icosahedronGeometry args={[0.15, 0]} />
                       <meshStandardMaterial color="#d97706" />
                   </mesh>
               ))}
            </group>

            {/* Leaves - Spiky Crown */}
            <group position={[0, 0.6, 0]}>
                {/* Inner Ring */}
                {[0, 1, 2, 3].map(i => (
                    <mesh key={`in-${i}`} rotation={[0, i * (Math.PI/2), 0]} position={[0, 0.3, 0]}>
                         <coneGeometry args={[0.15, 0.8, 3]} />
                         <meshStandardMaterial color="#15803d" />
                    </mesh>
                ))}
                {/* Outer Ring */}
                {[0, 1, 2, 3, 4].map(i => (
                    <mesh key={`out-${i}`} rotation={[0.4, i * (Math.PI*2/5), 0]} position={[0, 0.2, 0]}>
                        <coneGeometry args={[0.15, 0.6, 3]} />
                        <meshStandardMaterial color="#166534" />
                    </mesh>
                ))}
            </group>
        </group>
    )
}

const LightOrb = () => (
  // Reduced size by ~10% (scale 5.4 instead of 6)
  <group scale={[5.4, 5.4, 5.4]} position={[0, 2.5, 0]}>
      <mesh>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshBasicMaterial color="#facc15" /> {/* Yellow-400 */}
      </mesh>
      {/* Halo */}
      <mesh scale={[1.4, 1.4, 1.4]}>
         <sphereGeometry args={[0.4, 32, 32]} />
         <meshBasicMaterial color="#fde047" transparent opacity={0.4} side={THREE.BackSide} />
      </mesh>
      {/* Yellow Point Light */}
      <pointLight distance={30} intensity={2.5} color="#fef08a" />
  </group>
);

const Tree = () => (
    <group scale={[4, 5, 4]} position={[0, 0, 0]}>
        {/* Trunk */}
        <mesh position={[0, 1, 0]}>
            <cylinderGeometry args={[0.2, 0.4, 2, 6]} />
            <meshStandardMaterial color="#451a03" />
        </mesh>
        {/* Leaves Levels */}
        <mesh position={[0, 2, 0]}>
            <coneGeometry args={[1.5, 2.5, 7]} />
            <meshStandardMaterial color="#166534" roughness={0.9} />
        </mesh>
        <mesh position={[0, 3.5, 0]}>
            <coneGeometry args={[1.2, 2.5, 7]} />
            <meshStandardMaterial color="#15803d" roughness={0.9} />
        </mesh>
    </group>
)

const CurvedGuideLine = ({ carX, targetX, targetZ }: { carX: number, targetX: number, targetZ: number }) => {
    // Generate curve points
    const points = useMemo(() => {
        // Quadratic Bezier-ish path: Start at Car, Control Point bends towards target, End at Target
        // Local Car Position is visually (0, 0, 0).
        // Target Screen Position is (targetX - carX, 0, targetZ).
        
        const start = new THREE.Vector3(0, 0.5, 0);
        const end = new THREE.Vector3(targetX - carX, 0.5, targetZ);
        
        // Control point: Halfway in Z, but aligned closer to X to make it curve out
        const control = new THREE.Vector3(0, 0.5, targetZ * 0.4); 
        
        const curve = new THREE.QuadraticBezierCurve3(start, control, end);
        return curve.getPoints(20);
    }, [carX, targetX, targetZ]);
    
    // Dynamic Opacity based on distance (Closer = Fainter)
    const opacity = Math.min(Math.abs(targetZ) / 100, 0.8);

    return (
        <Line 
            points={points}
            color="#06b6d4" // Bright Cyan
            lineWidth={6}
            transparent
            opacity={opacity}
        />
    )
}

const Items = ({ speed, worldXRef, onScore, onCrash }: { 
    speed: number, 
    worldXRef: React.MutableRefObject<number>, 
    onScore: (t: 'light' | 'pineapple') => void,
    onCrash: () => void
}) => {
    const [items] = useState<ItemData[]>(() => {
        return Array.from({length: 80}).map((_, i) => ({ 
            id: i, 
            type: 'light', 
            x: 0, 
            z: -500 - (i * 10), 
            active: false,
            scaleVar: 1 
        }));
    });
    
    const groupRef = useRef<THREE.Group>(null);
    const [targetLight, setTargetLight] = useState<{x: number, z: number} | null>(null);

    useFrame((state, delta) => {
        const moveDist = speed * delta * 0.8; 
        
        // Spawn Logic
        if (Math.abs(speed) > 1) {
             const available = items.find(i => !i.active);
             
             // Reduced spawn chance for density control
             if(available && Math.random() < 0.15) { // Was 0.2
                available.active = true;
                const r = Math.random();
                
                // Spawn relative to World Center (The Road)
                if (r < 0.5) {
                    // Tree (Obstacle) - Side of road
                    available.type = 'tree';
                    const side = Math.random() > 0.5 ? 1 : -1;
                    const offset = 22 + Math.random() * 40;
                    available.x = side * offset;
                } else if (r < 0.98) { 
                    // Light - Scattered on Road
                    // Reduced spawn frequency implicitly by lowering total spawn chance
                    available.type = 'light';
                    available.x = (Math.random() - 0.5) * 30; 
                } else { // 2% chance Pineapple
                    available.type = 'pineapple';
                    available.x = (Math.random() - 0.5) * 20;
                }

                available.z = -300 - Math.random() * 100;
                available.scaleVar = 0.8 + Math.random() * 0.4;
             }
        }

        let nearestZ = -9999;
        let foundTarget = null;

        if (groupRef.current) {
            items.forEach((item, i) => {
                const meshGroup = groupRef.current!.children[i];
                if (!item.active) {
                    meshGroup.visible = false;
                    return;
                }

                meshGroup.visible = true;
                item.z += moveDist; 
                
                // Screen X Calculation: Item World Pos - Car World Pos
                const screenX = item.x - worldXRef.current;
                
                // Track nearest light for line
                if (item.type === 'light' && item.z < 0 && item.z > nearestZ) {
                    nearestZ = item.z;
                    foundTarget = { x: item.x, z: item.z };
                }
                
                meshGroup.position.set(screenX, 0, item.z);
                
                // Animation
                if(item.type === 'pineapple') {
                  meshGroup.rotation.y += delta * 2;
                } else if (item.type === 'light') {
                  meshGroup.position.y = Math.sin(state.clock.elapsedTime * 3 + item.id) * 0.5;
                }

                // Collision Logic
                if (item.z > -2 && item.z < 2) {
                    const dist = Math.abs(screenX); // Car is at 0
                    if (item.type === 'tree') {
                         if (dist < 3.5) { 
                             onCrash();
                             item.active = false;
                         }
                    } else {
                        if (dist < 4.5) { // Wider hitbox
                            item.active = false;
                            onScore(item.type as 'light' | 'pineapple');
                        }
                    }
                }

                if(item.z > 20) item.active = false; 
            });
        }

        setTargetLight(foundTarget);
    });

    return (
        <group>
            <group ref={groupRef}>
                {items.map((item, i) => (
                    <group key={i}>
                        {item.type === 'light' ? <LightOrb /> : 
                        item.type === 'pineapple' ? <PineappleMesh /> : 
                        <Tree />}
                    </group>
                ))}
            </group>
            
            {/* Guide Laser */}
            {targetLight && (
                <CurvedGuideLine carX={worldXRef.current} targetX={targetLight.x} targetZ={targetLight.z} />
            )}
        </group>
    );
};

// -- Environment --

const SkyGradient = () => {
  useFrame((state) => {
    const cycle = 300;
    const time = state.clock.elapsedTime % cycle;
    const t = time / cycle; 

    const c1 = new THREE.Color('#cffafe'); // Cyan/Ice
    const c2 = new THREE.Color('#fcd34d'); // Gold
    const c3 = new THREE.Color('#6366f1'); // Violet
    
    let current;
    if (t < 0.5) {
        current = c1.lerp(c2, t * 2);
    } else {
        current = c2.lerp(c3, (t - 0.5) * 2);
    }
    
    state.scene.background = current;
    if(state.scene.fog) {
        (state.scene.fog as THREE.Fog).color.copy(current);
    }
  });
  return null;
}

const SceneContent = ({ speed, steering, onScore, onCrash, onTerrainChange }: GameSceneProps) => {
    const worldXRef = useRef(0);

    useFrame((_, delta) => {
        if (Math.abs(speed) > 1) {
            // KID MODE: Slower lateral movement multiplier (0.25) for gentler turns
            const turnRate = steering * (Math.abs(speed) + 15) * delta * 0.25;
            worldXRef.current += turnRate;
        }

        // Terrain Check
        // Road width approx 30
        const isOffRoad = Math.abs(worldXRef.current) > 16;
        onTerrainChange(isOffRoad ? 'grass' : 'road');
    });

    return (
        <>
            <PerspectiveCamera makeDefault position={[0, 6, 14]} fov={55} rotation={[-0.25, 0, 0]} />
            <SkyGradient />
            
            <ambientLight intensity={0.8} color="#fff" />
            <directionalLight position={[50, 50, 25]} intensity={1.0} color="#fff" castShadow />
            
            {/* Extended Fog distance so items don't pop in too late */}
            <fog attach="fog" args={['#fff', 10, 300]} /> 

            {/* Fixed Car */}
            <FerrariDream speed={speed} steering={steering} />
            
            {/* Moving World Objects */}
            <Items speed={speed} worldXRef={worldXRef} onScore={onScore} onCrash={onCrash} />

            {/* GROUND */}
            <group position={[0, -0.05, 0]}>
                 {/* Infinite Grass */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                    <planeGeometry args={[1000, 1000]} />
                    <meshStandardMaterial 
                        color="#dcfce7" 
                        roughness={1} 
                        metalness={0.0}
                    />
                </mesh>
                
                {/* Road Strip */}
                <RoadStrip worldXRef={worldXRef} />
            </group>
            
            <Stars radius={200} depth={50} count={3000} factor={4} saturation={0} fade speed={0.5} />
        </>
    );
};

const RoadStrip = ({ worldXRef }: { worldXRef: React.MutableRefObject<number> }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    useFrame(() => {
        if(meshRef.current) {
            // Road moves visually opposite to car's world position
            meshRef.current.position.x = -worldXRef.current;
        }
    });

    return (
        <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} receiveShadow>
             <planeGeometry args={[32, 1000]} /> 
             <meshStandardMaterial color="#f5f5f4" roughness={0.8} /> 
        </mesh>
    );
};

export const GameScene: React.FC<GameSceneProps> = (props) => {
  return (
    <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
       <SceneContent {...props} />
    </Canvas>
  );
};