import { useState } from "react";
import heroArLabsImg from "@/assets/hero-ar-labs.jpg";
import { PageHeroBanner } from "@/components/PageHeroBanner";
import { useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment } from "@react-three/drei";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Atom, Dna, Zap, Droplets, Sun, Wind, Trophy, Star, CheckCircle2, Flame, TestTube } from "lucide-react";
import { toast } from "sonner";

// Physics Pendulum Experiment
function PendulumExperiment() {
  return (
    <group>
      {/* Pendulum string */}
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 4]} />
        <meshStandardMaterial color="hsl(var(--primary))" />
      </mesh>
      
      {/* Pendulum bob */}
      <mesh position={[0, -1, 0]}>
        <sphereGeometry args={[0.3]} />
        <meshStandardMaterial color="hsl(var(--accent))" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Support beam */}
      <mesh position={[0, 4, 0]}>
        <boxGeometry args={[2, 0.2, 0.2]} />
        <meshStandardMaterial color="hsl(var(--muted))" />
      </mesh>
    </group>
  );
}

// DNA Helix Experiment
function DNAHelix() {
  const helixPoints = [];
  for (let i = 0; i < 100; i++) {
    const t = (i / 100) * Math.PI * 4;
    helixPoints.push({
      x: Math.cos(t) * 0.5,
      y: (i / 100) * 4 - 2,
      z: Math.sin(t) * 0.5,
    });
  }

  return (
    <group>
      {helixPoints.map((point, i) => (
        <group key={i}>
          <mesh position={[point.x, point.y, point.z]}>
            <sphereGeometry args={[0.08]} />
            <meshStandardMaterial color={i % 2 === 0 ? "hsl(var(--primary))" : "hsl(var(--accent))"} />
          </mesh>
          {i < helixPoints.length - 1 && (
            <mesh
              position={[
                (point.x + helixPoints[i + 1].x) / 2,
                (point.y + helixPoints[i + 1].y) / 2,
                (point.z + helixPoints[i + 1].z) / 2,
              ]}
            >
              <cylinderGeometry args={[0.02, 0.02, 0.1]} />
              <meshStandardMaterial color="hsl(var(--muted))" />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

// Solar System Experiment
function SolarSystem() {
  return (
    <group>
      {/* Sun */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.5]} />
        <meshStandardMaterial color="hsl(var(--accent))" emissive="hsl(var(--accent))" emissiveIntensity={0.5} />
      </mesh>
      
      {/* Earth */}
      <mesh position={[2, 0, 0]}>
        <sphereGeometry args={[0.2]} />
        <meshStandardMaterial color="hsl(173, 80%, 40%)" />
      </mesh>
      
      {/* Mars */}
      <mesh position={[-2.5, 0, 0]}>
        <sphereGeometry args={[0.15]} />
        <meshStandardMaterial color="hsl(0, 84%, 60%)" />
      </mesh>
      
      {/* Venus */}
      <mesh position={[0, 0, 1.5]}>
        <sphereGeometry args={[0.18]} />
        <meshStandardMaterial color="hsl(43, 74%, 66%)" />
      </mesh>
    </group>
  );
}

// Atom Structure Experiment
function AtomStructure() {
  return (
    <group>
      {/* Nucleus */}
      <mesh>
        <sphereGeometry args={[0.3]} />
        <meshStandardMaterial color="hsl(var(--destructive))" />
      </mesh>
      
      {/* Electron orbits */}
      {[1, 1.5, 2].map((radius, idx) => (
        <group key={idx} rotation={[Math.PI / 3 * idx, 0, 0]}>
          <mesh position={[radius, 0, 0]}>
            <sphereGeometry args={[0.08]} />
            <meshStandardMaterial color="hsl(var(--primary))" />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[radius, 0.01, 16, 100]} />
            <meshStandardMaterial color="hsl(var(--muted-foreground))" transparent opacity={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Water Molecule Experiment
function WaterMolecule() {
  return (
    <group>
      {/* Oxygen atom (red) */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.4]} />
        <meshStandardMaterial color="hsl(0, 84%, 60%)" />
      </mesh>
      
      {/* Hydrogen atoms (white) */}
      <mesh position={[-0.6, 0.5, 0]}>
        <sphereGeometry args={[0.25]} />
        <meshStandardMaterial color="hsl(var(--foreground))" />
      </mesh>
      
      <mesh position={[0.6, 0.5, 0]}>
        <sphereGeometry args={[0.25]} />
        <meshStandardMaterial color="hsl(var(--foreground))" />
      </mesh>
      
      {/* Bonds */}
      <mesh position={[-0.3, 0.25, 0]} rotation={[0, 0, -Math.PI / 6]}>
        <cylinderGeometry args={[0.05, 0.05, 0.7]} />
        <meshStandardMaterial color="hsl(var(--muted))" />
      </mesh>
      
      <mesh position={[0.3, 0.25, 0]} rotation={[0, 0, Math.PI / 6]}>
        <cylinderGeometry args={[0.05, 0.05, 0.7]} />
        <meshStandardMaterial color="hsl(var(--muted))" />
      </mesh>
    </group>
  );
}

// Electric Circuit Experiment
function ElectricCircuit() {
  return (
    <group>
      {/* Battery */}
      <mesh position={[-2, 0, 0]}>
        <boxGeometry args={[0.4, 0.8, 0.3]} />
        <meshStandardMaterial color="hsl(var(--accent))" />
      </mesh>
      
      {/* Wires */}
      <mesh position={[-0.8, 0.4, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 2]} />
        <meshStandardMaterial color="hsl(var(--primary))" />
      </mesh>
      
      <mesh position={[0.8, 0.4, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 2]} />
        <meshStandardMaterial color="hsl(var(--primary))" />
      </mesh>
      
      {/* Light bulb */}
      <mesh position={[2, 0, 0]}>
        <sphereGeometry args={[0.3]} />
        <meshStandardMaterial 
          color="hsl(var(--accent))" 
          emissive="hsl(var(--accent))" 
          emissiveIntensity={0.8}
          transparent
          opacity={0.7}
        />
      </mesh>
    </group>
  );
}

// Acid-Base Reaction Experiment
function AcidBaseReaction() {
  return (
    <group>
      {/* Beaker */}
      <mesh position={[0, -1, 0]}>
        <cylinderGeometry args={[0.6, 0.5, 1.5, 32]} />
        <meshStandardMaterial color="hsl(var(--card))" transparent opacity={0.3} />
      </mesh>
      
      {/* Liquid (pink/red indicating acidic) */}
      <mesh position={[0, -1.2, 0]}>
        <cylinderGeometry args={[0.55, 0.45, 1.2, 32]} />
        <meshStandardMaterial color="hsl(350, 80%, 60%)" transparent opacity={0.7} />
      </mesh>
      
      {/* Bubbles rising */}
      {[...Array(8)].map((_, i) => (
        <mesh key={i} position={[
          Math.cos(i) * 0.3,
          -0.8 + (i * 0.2),
          Math.sin(i) * 0.3
        ]}>
          <sphereGeometry args={[0.05 + Math.random() * 0.05]} />
          <meshStandardMaterial color="hsl(var(--accent))" transparent opacity={0.6} />
        </mesh>
      ))}
      
      {/* pH indicator strip */}
      <mesh position={[1, 0, 0]} rotation={[0, 0, Math.PI / 6]}>
        <boxGeometry args={[0.15, 0.8, 0.02]} />
        <meshStandardMaterial color="hsl(30, 90%, 60%)" />
      </mesh>
    </group>
  );
}

// Combustion Experiment
function CombustionExperiment() {
  return (
    <group>
      {/* Bunsen burner base */}
      <mesh position={[0, -1.5, 0]}>
        <cylinderGeometry args={[0.3, 0.4, 0.3, 32]} />
        <meshStandardMaterial color="hsl(var(--muted))" metalness={0.8} />
      </mesh>
      
      {/* Burner tube */}
      <mesh position={[0, -0.8, 0]}>
        <cylinderGeometry args={[0.1, 0.12, 1.4, 32]} />
        <meshStandardMaterial color="hsl(var(--muted))" metalness={0.6} />
      </mesh>
      
      {/* Flame */}
      <mesh position={[0, 0, 0]}>
        <coneGeometry args={[0.2, 0.6, 32]} />
        <meshStandardMaterial 
          color="hsl(20, 100%, 50%)" 
          emissive="hsl(20, 100%, 50%)" 
          emissiveIntensity={1}
          transparent
          opacity={0.8}
        />
      </mesh>
      
      {/* Blue inner flame */}
      <mesh position={[0, -0.1, 0]}>
        <coneGeometry args={[0.12, 0.4, 32]} />
        <meshStandardMaterial 
          color="hsl(220, 100%, 60%)" 
          emissive="hsl(220, 100%, 60%)" 
          emissiveIntensity={1.2}
          transparent
          opacity={0.9}
        />
      </mesh>
      
      {/* Test tube over flame */}
      <mesh position={[0, 0.8, 0.5]} rotation={[Math.PI / 6, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 1, 32]} />
        <meshStandardMaterial color="hsl(var(--card))" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

// Crystal Structure Experiment
function CrystalStructure() {
  const positions = [
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1],
    [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1],
    [-1, 0, 0], [0, -1, 0], [0, 0, -1]
  ];
  
  return (
    <group>
      {positions.map((pos, i) => (
        <group key={i}>
          <mesh position={pos as [number, number, number]}>
            <sphereGeometry args={[0.2]} />
            <meshStandardMaterial 
              color={i % 2 === 0 ? "hsl(280, 100%, 70%)" : "hsl(190, 100%, 60%)"} 
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
          {/* Bonds */}
          {i < positions.length - 1 && (
            <mesh
              position={[
                (pos[0] + positions[i + 1][0]) / 2,
                (pos[1] + positions[i + 1][1]) / 2,
                (pos[2] + positions[i + 1][2]) / 2,
              ]}
            >
              <cylinderGeometry args={[0.03, 0.03, 0.3]} />
              <meshStandardMaterial color="hsl(var(--muted-foreground))" />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

// Human Heart Experiment
function HumanHeart() {
  return (
    <group>
      {/* Main heart body */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshStandardMaterial color="hsl(0, 70%, 45%)" />
      </mesh>
      {/* Left ventricle */}
      <mesh position={[-0.3, -0.5, 0.2]}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color="hsl(0, 65%, 40%)" />
      </mesh>
      {/* Right ventricle */}
      <mesh position={[0.3, -0.5, 0.2]}>
        <sphereGeometry args={[0.45, 32, 32]} />
        <meshStandardMaterial color="hsl(0, 60%, 50%)" />
      </mesh>
      {/* Aorta */}
      <mesh position={[0, 0.8, 0]} rotation={[0.3, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.2, 0.8]} />
        <meshStandardMaterial color="hsl(0, 80%, 35%)" />
      </mesh>
      {/* Pulmonary artery */}
      <mesh position={[-0.3, 0.7, 0.2]} rotation={[0.2, 0, -0.3]}>
        <cylinderGeometry args={[0.1, 0.12, 0.6]} />
        <meshStandardMaterial color="hsl(220, 70%, 50%)" />
      </mesh>
      {/* Superior vena cava */}
      <mesh position={[0.25, 0.6, -0.1]} rotation={[0.1, 0, 0.2]}>
        <cylinderGeometry args={[0.08, 0.1, 0.5]} />
        <meshStandardMaterial color="hsl(220, 60%, 40%)" />
      </mesh>
    </group>
  );
}

// Human Skeleton Experiment
function HumanSkeleton() {
  return (
    <group scale={0.8}>
      {/* Skull */}
      <mesh position={[0, 2.2, 0]}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial color="hsl(40, 30%, 90%)" />
      </mesh>
      {/* Jaw */}
      <mesh position={[0, 1.95, 0.1]}>
        <boxGeometry args={[0.25, 0.15, 0.2]} />
        <meshStandardMaterial color="hsl(40, 25%, 85%)" />
      </mesh>
      {/* Spine */}
      {[...Array(12)].map((_, i) => (
        <mesh key={i} position={[0, 1.7 - i * 0.15, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.12]} />
          <meshStandardMaterial color="hsl(40, 20%, 88%)" />
        </mesh>
      ))}
      {/* Ribcage */}
      {[...Array(6)].map((_, i) => (
        <group key={i}>
          <mesh position={[0.25, 1.4 - i * 0.12, 0.1]} rotation={[0, 0, 0.8]}>
            <torusGeometry args={[0.2, 0.02, 8, 16, Math.PI]} />
            <meshStandardMaterial color="hsl(40, 25%, 85%)" />
          </mesh>
          <mesh position={[-0.25, 1.4 - i * 0.12, 0.1]} rotation={[0, Math.PI, 0.8]}>
            <torusGeometry args={[0.2, 0.02, 8, 16, Math.PI]} />
            <meshStandardMaterial color="hsl(40, 25%, 85%)" />
          </mesh>
        </group>
      ))}
      {/* Pelvis */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.5, 0.2, 0.15]} />
        <meshStandardMaterial color="hsl(40, 30%, 87%)" />
      </mesh>
      {/* Arms */}
      <mesh position={[0.5, 1.5, 0]} rotation={[0, 0, 0.2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.8]} />
        <meshStandardMaterial color="hsl(40, 25%, 88%)" />
      </mesh>
      <mesh position={[-0.5, 1.5, 0]} rotation={[0, 0, -0.2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.8]} />
        <meshStandardMaterial color="hsl(40, 25%, 88%)" />
      </mesh>
      {/* Legs */}
      <mesh position={[0.15, -0.4, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 1]} />
        <meshStandardMaterial color="hsl(40, 25%, 88%)" />
      </mesh>
      <mesh position={[-0.15, -0.4, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 1]} />
        <meshStandardMaterial color="hsl(40, 25%, 88%)" />
      </mesh>
    </group>
  );
}

// Cell Division (Mitosis) Experiment
function CellDivision() {
  return (
    <group>
      {/* Parent cell membrane */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color="hsl(120, 40%, 60%)" transparent opacity={0.4} />
      </mesh>
      {/* Nucleus dividing */}
      <mesh position={[-0.3, 0, 0]}>
        <sphereGeometry args={[0.35]} />
        <meshStandardMaterial color="hsl(270, 60%, 50%)" />
      </mesh>
      <mesh position={[0.3, 0, 0]}>
        <sphereGeometry args={[0.35]} />
        <meshStandardMaterial color="hsl(270, 60%, 50%)" />
      </mesh>
      {/* Chromosomes */}
      {[-0.3, 0.3].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          {[...Array(4)].map((_, j) => (
            <mesh key={j} position={[Math.cos(j * Math.PI / 2) * 0.15, Math.sin(j * Math.PI / 2) * 0.15, 0]}>
              <capsuleGeometry args={[0.03, 0.1, 4, 8]} />
              <meshStandardMaterial color="hsl(350, 70%, 55%)" />
            </mesh>
          ))}
        </group>
      ))}
      {/* Spindle fibers */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.01, 0.01, 0.5]} />
        <meshStandardMaterial color="hsl(60, 70%, 50%)" />
      </mesh>
      {/* Cytoplasm organelles */}
      {[...Array(8)].map((_, i) => (
        <mesh key={i} position={[
          Math.cos(i * Math.PI / 4) * 0.7,
          Math.sin(i * Math.PI / 4) * 0.7,
          0
        ]}>
          <sphereGeometry args={[0.08]} />
          <meshStandardMaterial color="hsl(30, 60%, 55%)" />
        </mesh>
      ))}
    </group>
  );
}

// Digestive System Experiment
function DigestiveSystem() {
  return (
    <group scale={0.6}>
      {/* Esophagus */}
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 1]} />
        <meshStandardMaterial color="hsl(350, 50%, 55%)" />
      </mesh>
      {/* Stomach */}
      <mesh position={[-0.2, 1, 0]} rotation={[0, 0, 0.3]}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color="hsl(350, 60%, 50%)" />
      </mesh>
      {/* Small intestine (coiled) */}
      {[...Array(8)].map((_, i) => (
        <mesh key={i} position={[
          Math.sin(i * 0.8) * 0.3,
          0.3 - i * 0.15,
          Math.cos(i * 0.8) * 0.2
        ]}>
          <cylinderGeometry args={[0.08, 0.08, 0.3]} />
          <meshStandardMaterial color="hsl(20, 60%, 60%)" />
        </mesh>
      ))}
      {/* Large intestine */}
      <mesh position={[0.5, -0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.12, 0.8]} />
        <meshStandardMaterial color="hsl(30, 50%, 50%)" />
      </mesh>
      <mesh position={[0.5, 0.2, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.6]} />
        <meshStandardMaterial color="hsl(30, 50%, 50%)" />
      </mesh>
      <mesh position={[-0.5, -0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.12, 0.8]} />
        <meshStandardMaterial color="hsl(30, 50%, 50%)" />
      </mesh>
      {/* Liver */}
      <mesh position={[0.4, 1.2, 0.3]}>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshStandardMaterial color="hsl(10, 60%, 35%)" />
      </mesh>
    </group>
  );
}

// Neuron Experiment
function NeuronCell() {
  return (
    <group>
      {/* Cell body (Soma) */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.4]} />
        <meshStandardMaterial color="hsl(280, 50%, 50%)" />
      </mesh>
      {/* Nucleus */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.15]} />
        <meshStandardMaterial color="hsl(260, 60%, 40%)" />
      </mesh>
      {/* Axon */}
      <mesh position={[1.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 2]} />
        <meshStandardMaterial color="hsl(200, 50%, 55%)" />
      </mesh>
      {/* Myelin sheath */}
      {[...Array(5)].map((_, i) => (
        <mesh key={i} position={[0.5 + i * 0.35, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.08, 0.08, 0.2]} />
          <meshStandardMaterial color="hsl(45, 60%, 70%)" />
        </mesh>
      ))}
      {/* Axon terminal */}
      {[...Array(4)].map((_, i) => (
        <mesh key={i} position={[
          2.2 + Math.cos(i * Math.PI / 2) * 0.15,
          Math.sin(i * Math.PI / 2) * 0.15,
          0
        ]}>
          <sphereGeometry args={[0.08]} />
          <meshStandardMaterial color="hsl(120, 50%, 50%)" />
        </mesh>
      ))}
      {/* Dendrites */}
      {[...Array(5)].map((_, i) => {
        const angle = (i / 5) * Math.PI + Math.PI / 2;
        return (
          <mesh key={i} position={[
            -0.4 + Math.cos(angle) * 0.3,
            Math.sin(angle) * 0.5,
            0
          ]} rotation={[0, 0, angle]}>
            <cylinderGeometry args={[0.03, 0.02, 0.5]} />
            <meshStandardMaterial color="hsl(280, 40%, 60%)" />
          </mesh>
        );
      })}
    </group>
  );
}

export default function ARStemLabs() {
  const navigate = useNavigate();
  const [selectedExperiment, setSelectedExperiment] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedExperiments, setCompletedExperiments] = useState<string[]>([]);
  const [points, setPoints] = useState(0);

  const experiments = [
    {
      id: "pendulum",
      title: "Physics Pendulum",
      description: "Explore oscillation and energy transfer",
      icon: <Zap className="w-5 h-5" />,
      component: PendulumExperiment,
      category: "Physics",
      difficulty: "Beginner",
      points: 50,
      steps: [
        { title: "Observe the Setup", description: "Notice the pendulum bob suspended by a string from a fixed point." },
        { title: "Understand Motion", description: "The pendulum swings back and forth in a periodic motion called oscillation." },
        { title: "Energy Transfer", description: "As it swings, energy converts between kinetic (motion) and potential (height)." },
        { title: "Key Concept", description: "The period of swing depends on the length of the string, not the mass of the bob." },
      ],
    },
    {
      id: "dna",
      title: "DNA Double Helix",
      description: "Discover the structure of DNA",
      icon: <Dna className="w-5 h-5" />,
      component: DNAHelix,
      category: "Biology",
      difficulty: "Intermediate",
      points: 75,
      steps: [
        { title: "Identify the Structure", description: "DNA has a twisted ladder shape called a double helix." },
        { title: "Base Pairs", description: "The colored spheres represent nucleotide bases (A-T and G-C pairs)." },
        { title: "Genetic Code", description: "The sequence of these bases stores all genetic information." },
        { title: "Replication", description: "The two strands can separate and create copies during cell division." },
      ],
    },
    {
      id: "solar",
      title: "Solar System",
      description: "Navigate through our solar system",
      icon: <Sun className="w-5 h-5" />,
      component: SolarSystem,
      category: "Astronomy",
      difficulty: "Beginner",
      points: 60,
      steps: [
        { title: "The Sun", description: "The bright sphere at the center is our Sun, providing light and heat." },
        { title: "Planets", description: "Observe Earth (blue-green), Mars (red), and Venus (yellow) orbiting the Sun." },
        { title: "Orbits", description: "Planets move in elliptical paths around the Sun due to gravity." },
        { title: "Scale", description: "In reality, distances are much larger than shown here." },
      ],
    },
    {
      id: "atom",
      title: "Atomic Structure",
      description: "Visualize electrons orbiting the nucleus",
      icon: <Atom className="w-5 h-5" />,
      component: AtomStructure,
      category: "Chemistry",
      difficulty: "Intermediate",
      points: 80,
      steps: [
        { title: "Nucleus", description: "The red sphere at center contains protons (positive) and neutrons (neutral)." },
        { title: "Electrons", description: "The small purple spheres are electrons (negative charge) orbiting the nucleus." },
        { title: "Energy Levels", description: "Electrons orbit in specific shells or energy levels around the nucleus." },
        { title: "Atomic Balance", description: "Number of protons equals electrons in a neutral atom." },
      ],
    },
    {
      id: "water",
      title: "Water Molecule",
      description: "Understand H₂O molecular structure",
      icon: <Droplets className="w-5 h-5" />,
      component: WaterMolecule,
      category: "Chemistry",
      difficulty: "Beginner",
      points: 55,
      steps: [
        { title: "Molecular Formula", description: "Water is H₂O - two hydrogen atoms bonded to one oxygen atom." },
        { title: "Oxygen Atom", description: "The large red sphere is oxygen, which is electronegative." },
        { title: "Hydrogen Atoms", description: "The two white spheres are hydrogen atoms." },
        { title: "Polar Molecule", description: "The bent shape makes water polar, enabling it to dissolve many substances." },
      ],
    },
    {
      id: "circuit",
      title: "Electric Circuit",
      description: "Learn about electricity flow",
      icon: <Wind className="w-5 h-5" />,
      component: ElectricCircuit,
      category: "Physics",
      difficulty: "Intermediate",
      points: 70,
      steps: [
        { title: "Power Source", description: "The battery provides electrical energy to the circuit." },
        { title: "Conductors", description: "Wires (purple) carry electric current from battery to bulb." },
        { title: "Load", description: "The light bulb converts electrical energy to light and heat." },
        { title: "Complete Path", description: "Current only flows when there's a complete circuit path." },
      ],
    },
    {
      id: "acidbase",
      title: "Acid-Base Reaction",
      description: "Observe chemical reactions and pH changes",
      icon: <TestTube className="w-5 h-5" />,
      component: AcidBaseReaction,
      category: "Chemistry",
      difficulty: "Advanced",
      points: 90,
      steps: [
        { title: "Acid Solution", description: "The pink/red liquid indicates an acidic solution (low pH)." },
        { title: "Chemical Reaction", description: "Bubbles form when acid reacts with a base or metal." },
        { title: "pH Indicator", description: "The strip on the side changes color to show pH level." },
        { title: "Neutralization", description: "Adding base to acid produces salt and water in neutralization." },
      ],
    },
    {
      id: "combustion",
      title: "Combustion Reaction",
      description: "Explore burning and chemical reactions",
      icon: <Flame className="w-5 h-5" />,
      component: CombustionExperiment,
      category: "Chemistry",
      difficulty: "Advanced",
      points: 95,
      steps: [
        { title: "Heat Source", description: "The Bunsen burner provides controlled heat for experiments." },
        { title: "Combustion", description: "Orange flame shows incomplete combustion; blue shows complete combustion." },
        { title: "Energy Release", description: "Burning releases energy in the form of heat and light." },
        { title: "Safety", description: "Always use proper equipment and ventilation when working with fire." },
      ],
    },
    {
      id: "crystal",
      title: "Crystal Lattice",
      description: "Examine molecular arrangement in crystals",
      icon: <Atom className="w-5 h-5" />,
      component: CrystalStructure,
      category: "Chemistry",
      difficulty: "Advanced",
      points: 85,
      steps: [
        { title: "Ordered Structure", description: "Atoms in crystals arrange in repeating 3D patterns." },
        { title: "Lattice Points", description: "Each sphere represents an atom or ion at a lattice point." },
        { title: "Ionic Bonds", description: "The connections show chemical bonds holding the structure together." },
        { title: "Properties", description: "This organized structure gives crystals their unique properties." },
      ],
    },
    {
      id: "heart",
      title: "Human Heart",
      description: "Explore the anatomy of the human heart",
      icon: <Dna className="w-5 h-5" />,
      component: HumanHeart,
      category: "Biology",
      difficulty: "Intermediate",
      points: 85,
      steps: [
        { title: "Heart Chambers", description: "The heart has four chambers: two atria (top) and two ventricles (bottom)." },
        { title: "Blood Flow", description: "Deoxygenated blood enters the right side, oxygenated blood exits from the left." },
        { title: "Major Vessels", description: "The aorta carries blood away; vena cava brings blood back to the heart." },
        { title: "Cardiac Cycle", description: "The heart beats about 100,000 times per day, pumping blood throughout the body." },
      ],
    },
    {
      id: "skeleton",
      title: "Human Skeleton",
      description: "Study the skeletal system structure",
      icon: <Dna className="w-5 h-5" />,
      component: HumanSkeleton,
      category: "Anatomy",
      difficulty: "Intermediate",
      points: 90,
      steps: [
        { title: "Skeletal Framework", description: "The adult human skeleton contains 206 bones providing structure and protection." },
        { title: "Skull & Spine", description: "The skull protects the brain while the spine supports the body and protects the spinal cord." },
        { title: "Ribcage", description: "12 pairs of ribs protect vital organs like the heart and lungs." },
        { title: "Limbs", description: "Arms and legs enable movement through joints and muscle attachments." },
      ],
    },
    {
      id: "celldivision",
      title: "Cell Division (Mitosis)",
      description: "Watch cells divide and replicate",
      icon: <Dna className="w-5 h-5" />,
      component: CellDivision,
      category: "Biology",
      difficulty: "Advanced",
      points: 95,
      steps: [
        { title: "Interphase", description: "The cell prepares by duplicating its DNA and organelles before division." },
        { title: "Prophase", description: "Chromosomes condense and become visible; nuclear membrane breaks down." },
        { title: "Metaphase/Anaphase", description: "Chromosomes align at center, then separate to opposite poles." },
        { title: "Cytokinesis", description: "The cell membrane pinches inward, creating two identical daughter cells." },
      ],
    },
    {
      id: "digestive",
      title: "Digestive System",
      description: "Explore how food is processed",
      icon: <Dna className="w-5 h-5" />,
      component: DigestiveSystem,
      category: "Anatomy",
      difficulty: "Advanced",
      points: 100,
      steps: [
        { title: "Esophagus", description: "Food travels down the esophagus to the stomach through peristalsis." },
        { title: "Stomach", description: "The stomach breaks down food with acids and enzymes into chyme." },
        { title: "Small Intestine", description: "Most nutrient absorption occurs in the 6-meter long small intestine." },
        { title: "Large Intestine", description: "Water is absorbed and waste is compacted before elimination." },
      ],
    },
    {
      id: "neuron",
      title: "Neuron Cell",
      description: "Understand nerve cell structure",
      icon: <Dna className="w-5 h-5" />,
      component: NeuronCell,
      category: "Biology",
      difficulty: "Advanced",
      points: 95,
      steps: [
        { title: "Cell Body (Soma)", description: "Contains the nucleus and produces proteins needed for the neuron." },
        { title: "Dendrites", description: "Branch-like extensions that receive signals from other neurons." },
        { title: "Axon & Myelin", description: "The axon transmits signals; myelin sheath speeds up transmission." },
        { title: "Synaptic Terminals", description: "Release neurotransmitters to communicate with other cells." },
      ],
    },
  ];

  const currentExperiment = experiments.find((exp) => exp.id === selectedExperiment);

  const handleCompleteExperiment = () => {
    if (currentExperiment && !completedExperiments.includes(currentExperiment.id)) {
      setCompletedExperiments([...completedExperiments, currentExperiment.id]);
      setPoints(points + currentExperiment.points);
      toast.success(`Experiment completed! +${currentExperiment.points} points earned!`, {
        icon: <Trophy className="w-4 h-4 text-accent" />,
      });
    }
    setCurrentStep(0);
    setSelectedExperiment(null);
  };

  const progressPercentage = (completedExperiments.length / experiments.length) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">AR STEM Labs</h1>
                <p className="text-sm text-muted-foreground">
                  Interactive 3D experiments for immersive learning
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-lg">
                <Trophy className="w-5 h-5 text-accent" />
                <span className="font-bold text-foreground">{points}</span>
                <span className="text-sm text-muted-foreground">points</span>
              </div>
              <div className="flex items-center gap-2 bg-secondary px-4 py-2 rounded-lg">
                <Star className="w-5 h-5 text-primary" />
                <span className="font-semibold text-foreground">
                  {completedExperiments.length}/{experiments.length}
                </span>
              </div>
            </div>
          </div>
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Overall Progress</span>
              <span className="text-sm font-medium text-foreground">{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <PageHeroBanner image={heroArLabsImg} title="AR STEM Labs" subtitle="Interactive 3D experiments for immersive learning" badge="AR Technology" />
          {!selectedExperiment ? (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Choose an Experiment
                </h2>
                <p className="text-muted-foreground">
                  Select any experiment to explore in 3D. Drag to rotate, scroll to zoom.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {experiments.map((experiment) => {
                  const isCompleted = completedExperiments.includes(experiment.id);
                  return (
                    <Card
                      key={experiment.id}
                      className={`p-6 hover:border-primary transition-all cursor-pointer group relative ${
                        isCompleted ? "border-primary/50" : ""
                      }`}
                      onClick={() => {
                        setSelectedExperiment(experiment.id);
                        setCurrentStep(0);
                        toast.success(`Loading ${experiment.title}...`);
                      }}
                    >
                      {isCompleted && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle2 className="w-6 h-6 text-primary" />
                        </div>
                      )}
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          {experiment.icon}
                        </div>
                        <div className="flex flex-col gap-1">
                          <Badge variant="secondary" className="text-xs">
                            {experiment.category}
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              experiment.difficulty === "Beginner" 
                                ? "border-green-500 text-green-500" 
                                : experiment.difficulty === "Intermediate"
                                ? "border-yellow-500 text-yellow-500"
                                : "border-red-500 text-red-500"
                            }`}
                          >
                            {experiment.difficulty}
                          </Badge>
                        </div>
                      </div>
                      <h3 className="text-base font-semibold mb-2 text-foreground">
                        {experiment.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        {experiment.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-accent">
                          <Trophy className="w-4 h-4" />
                          <span className="text-sm font-semibold">{experiment.points} pts</span>
                        </div>
                        {isCompleted && (
                          <span className="text-xs text-primary font-medium">Completed</span>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-semibold text-foreground">
                      {currentExperiment?.title}
                    </h2>
                    <Badge variant="outline" className="text-xs">
                      {currentExperiment?.difficulty}
                    </Badge>
                    <div className="flex items-center gap-1 text-accent">
                      <Trophy className="w-4 h-4" />
                      <span className="text-sm font-semibold">{currentExperiment?.points} points</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {currentExperiment?.description}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedExperiment(null);
                    setCurrentStep(0);
                  }}
                >
                  Back to Experiments
                </Button>
              </div>

              {/* Step Progress */}
              <Card className="p-4 bg-secondary">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground">Learning Steps</h3>
                  <span className="text-sm text-muted-foreground">
                    Step {currentStep + 1} of {currentExperiment?.steps.length}
                  </span>
                </div>
                <Progress 
                  value={((currentStep + 1) / (currentExperiment?.steps.length || 1)) * 100} 
                  className="h-2 mb-4" 
                />
                <div className="bg-card p-4 rounded-lg border border-border">
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">
                      {currentStep + 1}
                    </span>
                    {currentExperiment?.steps[currentStep]?.title}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {currentExperiment?.steps[currentStep]?.description}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                    disabled={currentStep === 0}
                  >
                    Previous Step
                  </Button>
                  {currentStep < (currentExperiment?.steps.length || 0) - 1 ? (
                    <Button
                      size="sm"
                      onClick={() => setCurrentStep(currentStep + 1)}
                    >
                      Next Step
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={handleCompleteExperiment}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Complete Experiment
                    </Button>
                  )}
                </div>
              </Card>

              <Card className="p-2">
                <div className="w-full h-60 sm:h-96 md:h-[600px] rounded-lg overflow-hidden bg-background">
                  <Canvas>
                    <PerspectiveCamera makeDefault position={[0, 0, 5]} />
                    <OrbitControls 
                      enablePan={true}
                      enableZoom={true}
                      enableRotate={true}
                      minDistance={2}
                      maxDistance={10}
                    />
                    <ambientLight intensity={0.5} />
                    <directionalLight position={[10, 10, 5]} intensity={1} />
                    <directionalLight position={[-10, -10, -5]} intensity={0.5} />
                    <Environment preset="sunset" />
                    
                    {currentExperiment && <currentExperiment.component />}
                    
                    <gridHelper args={[10, 10, 'hsl(var(--border))', 'hsl(var(--border))']} />
                  </Canvas>
                </div>
              </Card>

              <Card className="p-6 bg-card border-primary/20">
                <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Atom className="w-5 h-5 text-primary" />
                  How to Interact with 3D Models
                </h3>
                <ul className="space-y-2 text-muted-foreground text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span><strong className="text-foreground">Rotate:</strong> Click and drag to rotate the experiment in any direction</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span><strong className="text-foreground">Zoom:</strong> Scroll or pinch to zoom in/out for closer inspection</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span><strong className="text-foreground">Pan:</strong> Right-click and drag to move the view around</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span><strong className="text-foreground">Reset:</strong> Double-click anywhere to reset to the default view</span>
                  </li>
                </ul>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
