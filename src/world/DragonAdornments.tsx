import type { DragonType } from "../dragons";
import { silhouetteFamily } from "../game/dragonVisuals";

/** Small root-level silhouette cues until each family receives an authored mesh. */
export default function DragonAdornments({ dragon }: { dragon: DragonType }) {
  const family = silhouetteFamily(dragon.id);
  const color = dragon.colors.spike;
  const horn = dragon.colors.horn;
  const material = <meshStandardMaterial color={color} roughness={0.62} metalness={dragon.effects?.clawMetalness ?? 0.08} />;
  const hornMaterial = <meshStandardMaterial color={horn} roughness={0.58} metalness={dragon.effects?.clawMetalness ?? 0.12} />;
  return <group>
    {family === "armored" && [-0.75, -0.2, 0.35, 0.85].map((z, i) => <mesh key={z} position={[0, 0.9 - i * 0.08, z]} scale={[0.5 - i * 0.06, 0.28, 0.28]} rotation={[0.08, 0, Math.PI / 4]} castShadow>
      <octahedronGeometry args={[1, 1]} />{material}
    </mesh>)}
    {family === "barbed" && <>
      <mesh position={[0, 0.16, 1.72]} rotation={[Math.PI / 2, 0, 0]} scale={[0.38, 0.85, 0.38]} castShadow><coneGeometry args={[0.5, 1.5, 10]} />{material}</mesh>
      {[-1, 1].map(side => <mesh key={side} position={[side * 0.32, 0.94, -1.12]} rotation={[-Math.PI / 2, 0, side * 0.18]} scale={[0.28, 0.65, 0.28]} castShadow><coneGeometry args={[0.45, 1.5, 10]} />{hornMaterial}</mesh>)}
    </>}
    {family === "finned" && <>
      {[-0.65, -0.08, 0.5].map((z, i) => <mesh key={z} position={[0, 0.92 - i * 0.08, z]} rotation={[0, 0, Math.PI]} scale={[0.18, 0.62 - i * 0.1, 0.55]} castShadow><coneGeometry args={[0.7, 1.5, 12]} />{material}</mesh>)}
      {[-1, 1].map(side => <mesh key={side} position={[side * 0.72, 0.15, 0.28]} rotation={[0, 0, side * 1.2]} scale={[0.16, 0.55, 0.42]}><coneGeometry args={[0.65, 1.4, 10]} />{material}</mesh>)}
    </>}
    {family === "spined" && [-0.85, -0.35, 0.15, 0.65, 1.05].map((z, i) => <mesh key={z} position={[0, 0.96 - i * 0.1, z]} scale={[0.22, 0.58 - i * 0.06, 0.22]} castShadow><coneGeometry args={[0.55, 1.3, 10]} />{material}</mesh>)}
    {family === "frilled" && <>
      {[-1, 1].map(side => <mesh key={side} position={[side * 0.46, 0.65, -0.78]} rotation={[0.18, 0, side * 1.15]} scale={[0.15, 0.62, 0.5]}><coneGeometry args={[0.7, 1.5, 12]} />{material}</mesh>)}
      <mesh position={[0, 1.02, -0.78]} scale={[0.22, 0.48, 0.22]}><coneGeometry args={[0.6, 1.3, 10]} />{material}</mesh>
    </>}
    {family === "swift" && [-1, 1].map(side => <mesh key={side} position={[side * 0.34, 0.94, -1.08]} rotation={[-Math.PI / 2, 0, side * 0.42]} scale={[0.22, 0.85, 0.22]} castShadow><coneGeometry args={[0.4, 1.7, 10]} />{hornMaterial}</mesh>)}
  </group>;
}
