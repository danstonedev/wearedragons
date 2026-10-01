import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
import { colorDragonModel, DRAGON_TYPES } from "../dragons";
import { dragonHead, isLying, isSnoring } from "../game/scavenger";
import type { LairDragonState } from "../game/scavenger";
import { useDragonAnimations } from "../world/useDragonAnimations";
import type { RaidState } from "./raidState";

const DRAGON_MODEL = `${import.meta.env.BASE_URL}dragon.glb`;
export const LAIR_DRAGON_SCALE = 3;

function glyphTexture(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "bold 104px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(0,0,0,0.75)";
  ctx.strokeText(text, 64, 70);
  ctx.fillStyle = color;
  ctx.fillText(text, 64, 70);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A flat sight fan pointing along +Z with a soft far edge. */
function fanGeometry(half: number) {
  const segments = 28;
  const positions: number[] = [0, 0, 0];
  const colors: number[] = [1, 1, 1, 0.9];
  for (let i = 0; i <= segments; i++) {
    const angle = -half + 2 * half * i / segments;
    positions.push(Math.sin(angle), 0, Math.cos(angle));
    colors.push(1, 1, 1, 0.05);
  }
  const indices: number[] = [];
  for (let i = 1; i <= segments; i++) indices.push(0, i + 1, i);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  return geometry;
}

export default function LairDragon({ raid, index }: { raid: RaidState; index: number }) {
  const def = raid.lair.dragons[index];
  const type = DRAGON_TYPES.find(item => item.id === def.tribe) ?? DRAGON_TYPES[0];
  const root = useRef<THREE.Group>(null);
  const cone = useRef<THREE.Mesh>(null);
  const alert = useRef<THREE.Group>(null);
  const alertBar = useRef<THREE.Mesh>(null);
  const zzz = useRef<THREE.Sprite[]>([]);
  const pose = useRef<"none" | "sleep" | "awake" | "lunge">("none");
  const eyesOpen = useRef(0);

  const { scene: source, animations } = useGLTF(DRAGON_MODEL);
  const scene = useMemo(() => {
    const clone = SkeletonUtils.clone(source);
    colorDragonModel(clone, type.colors, type.effects);
    clone.scale.setScalar(LAIR_DRAGON_SCALE);
    return clone;
  }, [source, type]);
  useEffect(() => () => {
    const owned = new Set<THREE.Material>();
    scene.traverse(child => {
      if (!(child as THREE.Mesh).isMesh) return;
      const material = (child as THREE.Mesh).material;
      for (const item of Array.isArray(material) ? material : [material]) owned.add(item);
    });
    owned.forEach(material => material.dispose());
  }, [scene]);
  const rig = useDragonAnimations(scene, animations);
  const bones = useMemo(() => ({
    neck: scene.getObjectByName("Neck"), head: scene.getObjectByName("Head"), body: scene.getObjectByName("Body"), eyes: scene.getObjectByName("Eyes"),
  }), [scene]);

  const assets = useMemo(() => ({
    fans: { stirring: fanGeometry(0.65), awake: fanGeometry(0.95), chase: fanGeometry(1.4) },
    fanMaterial: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, toneMapped: false }),
    question: glyphTexture("?", "#ffcf4a"),
    exclaim: glyphTexture("!", "#ff4a3a"),
    z: glyphTexture("z", "#d8e8ff"),
  }), []);
  useEffect(() => () => {
    Object.values(assets.fans).forEach(geometry => geometry.dispose());
    assets.fanMaterial.dispose();
    assets.question.dispose(); assets.exclaim.dispose(); assets.z.dispose();
  }, [assets]);
  const glyph = useRef<THREE.SpriteMaterial>(null);

  useFrame((state, frameDelta) => {
    const dragon: LairDragonState | undefined = raid.dragons[index];
    if (!dragon || !root.current) return;
    const delta = Math.min(frameDelta, 1 / 15);
    const t = state.clock.elapsedTime;
    const asleep = dragon.mode === "asleep";
    // A stir only opens the eyes and turns the head; the dragon gets up to investigate.
    const lying = isLying(dragon);
    const actions = rig.current.actions;
    const flying = actions.Dragon_Flying, death = actions.Dragon_Death, attack = actions.Dragon_Attack;

    // Pose: sprawled asleep (the end of the collapse clip), hovering awake, or lunging.
    const wanted = raid.catcher === def.id ? "lunge" : lying ? "sleep" : "awake";
    if (flying && death && wanted !== pose.current) {
      if (wanted === "sleep") {
        death.reset();
        death.setLoop(THREE.LoopOnce, 1);
        death.clampWhenFinished = true;
        if (pose.current === "none") {
          death.time = death.getClip().duration;
          death.setEffectiveWeight(1).play();
          flying.stop();
        } else {
          death.time = death.getClip().duration * 0.55;
          death.timeScale = 0.7;
          death.fadeIn(0.8).play();
          flying.fadeOut(0.8);
        }
      } else if (wanted === "awake") {
        flying.reset().fadeIn(pose.current === "none" ? 0 : 0.9).play();
        flying.timeScale = def.role === "patrol" ? 0.65 : 0.8;
        if (pose.current === "sleep") death.fadeOut(0.9);
      } else if (attack) {
        attack.reset();
        attack.setLoop(THREE.LoopOnce, 1);
        attack.clampWhenFinished = true;
        attack.fadeIn(0.12).play();
        flying.fadeOut(0.12);
        death.fadeOut(0.12);
      }
      pose.current = wanted;
    }
    if (flying && pose.current === "awake") flying.timeScale = dragon.mode === "chase" ? 1.3 : def.role === "patrol" ? 0.65 : 0.8;

    root.current.position.set(dragon.x, lying ? 0 : 0.25 + Math.sin(t * 2.1 + index) * 0.12, dragon.z);
    root.current.rotation.y = dragon.yaw;

    // Look around by turning the neck and head on top of the animation.
    bones.neck?.rotateY(dragon.look * 0.55);
    bones.head?.rotateY(dragon.look * 0.35);
    eyesOpen.current += ((asleep ? 0 : 1) - eyesOpen.current) * (1 - Math.exp(-8 * delta));
    bones.eyes?.scale.set(1, 0.12 + eyesOpen.current * 0.88, 1);
    if (bones.body) bones.body.scale.setScalar(lying ? 1 + Math.sin(dragon.snore / 4.6 * Math.PI * 2) * 0.035 : 1);

    // Sight fan on the floor: white while calm, amber when suspicious, red in a chase.
    const head = dragonHead(dragon);
    if (cone.current) {
      cone.current.visible = !asleep;
      if (!asleep) {
        const key = dragon.mode === "chase" ? "chase" : dragon.mode === "stirring" ? "stirring" : "awake";
        cone.current.geometry = assets.fans[key];
        const range = def.sight * (key === "chase" ? 1.4 : key === "stirring" ? 0.75 : 1);
        cone.current.position.set(head.x, 0.06, head.z);
        cone.current.rotation.set(0, dragon.yaw + dragon.look, 0);
        cone.current.scale.set(range, 1, range);
        const material = cone.current.material as THREE.MeshBasicMaterial;
        material.color.set(dragon.mode === "chase" ? "#ff3b2f" : dragon.suspicion > 40 ? "#ffb02e" : "#cfe0ff");
        material.opacity = dragon.mode === "chase" ? 0.34 : 0.16 + dragon.suspicion / 100 * 0.14;
      }
    }

    if (alert.current && glyph.current) {
      const showing = dragon.mode === "chase" || dragon.suspicion > 12 || ["stirring", "investigate", "search"].includes(dragon.mode);
      alert.current.visible = showing;
      alert.current.position.set(head.x, lying ? 5.4 : 13.2, head.z);
      glyph.current.map = dragon.mode === "chase" ? assets.exclaim : assets.question;
      alert.current.scale.setScalar(dragon.mode === "chase" ? 1.25 + Math.sin(t * 10) * 0.08 : 1);
      if (alertBar.current) {
        alertBar.current.scale.x = Math.max(0.02, dragon.suspicion / 100);
        alertBar.current.position.x = -0.9 * (1 - dragon.suspicion / 100);
        (alertBar.current.material as THREE.MeshBasicMaterial).color.set(dragon.suspicion >= 100 ? "#ff4a3a" : dragon.suspicion > 55 ? "#ffa53a" : "#ffd84a");
      }
    }

    // Zzz rise from the head while it sleeps, bigger on the loud snores.
    const snoring = isSnoring(dragon);
    zzz.current.forEach((sprite, i) => {
      if (!sprite) return;
      const cycle = ((t * 0.45 + i / 3) % 1);
      sprite.visible = asleep;
      sprite.position.set(head.x + cycle * 1.2 + i * 0.3, 2.6 + cycle * 3.5, head.z);
      sprite.scale.setScalar((0.6 + cycle * 0.9) * (snoring ? 1.5 : 1));
      (sprite.material as THREE.SpriteMaterial).opacity = (1 - cycle) * (snoring ? 0.95 : 0.55);
    });
  });

  return <>
    <group ref={root}>
      <primitive object={scene} />
    </group>
    <mesh ref={cone} geometry={assets.fans.awake} material={assets.fanMaterial} renderOrder={2} visible={false} />
    <Billboard ref={alert} visible={false}>
      <sprite scale={[1.8, 1.8, 1]}><spriteMaterial ref={glyph} map={assets.question} transparent depthWrite={false} toneMapped={false} /></sprite>
      <mesh position={[0, -1.2, 0]}><planeGeometry args={[1.9, 0.22]} /><meshBasicMaterial color="#1c1612" transparent opacity={0.8} depthWrite={false} /></mesh>
      <mesh ref={alertBar} position={[0, -1.2, 0.01]}><planeGeometry args={[1.8, 0.14]} /><meshBasicMaterial color="#ffd84a" depthWrite={false} toneMapped={false} /></mesh>
    </Billboard>
    {[0, 1, 2].map(i => <sprite key={i} ref={(sprite: THREE.Sprite | null) => { if (sprite) zzz.current[i] = sprite; }} visible={false}>
      <spriteMaterial map={assets.z} transparent depthWrite={false} toneMapped={false} />
    </sprite>)}
  </>;
}
