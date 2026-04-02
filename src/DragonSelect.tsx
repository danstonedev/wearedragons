import {
  useState,
  useRef,
  useEffect,
  Suspense,
  useMemo,
  useCallback,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import { DRAGON_TYPES, TRIBES, colorDragonModel } from "./dragons";
import type { DragonType } from "./dragons";
import ProjectileMesh from "./ProjectileMesh";
import { PROJECTILE_SIZE, MAX_STAT } from "./constants";
import "./DragonSelect.css";

import { SkeletonUtils } from "three-stdlib";

/* ---- Tribe atmosphere config ---- */
const TRIBE_ATMOSPHERE: Record<
  string,
  {
    subtitle: string;
    bg1: string;
    bg2: string;
    bg3: string;
    glow: string;
    glowAlpha: string;
    accent: string;
  }
> = {
  pyrrhia: {
    subtitle: "The Continent of Fire",
    bg1: "#0d0604",
    bg2: "#120806",
    bg3: "#1a0a05",
    glow: "#ff6b35",
    glowAlpha: "rgba(255,107,53,0.06)",
    accent: "#e8a050",
  },
  pantala: {
    subtitle: "The Distant Shore",
    bg1: "#040d06",
    bg2: "#060d08",
    bg3: "#0a1208",
    glow: "#7ba03c",
    glowAlpha: "rgba(123,160,60,0.06)",
    accent: "#c8a840",
  },
  glaeryus: {
    subtitle: "The Mythic Realm",
    bg1: "#04040d",
    bg2: "#06061a",
    bg3: "#0a0820",
    glow: "#6688dd",
    glowAlpha: "rgba(102,136,221,0.06)",
    accent: "#9988ee",
  },
};

/* ---- 3D Dragon Preview ---- */

function DragonModel({
  colors,
  effects,
  previewAnim,
}: {
  colors: DragonType["colors"];
  effects?: DragonType["effects"];
  previewAnim?: { name: string; key: number };
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF("/dragon.glb");
  const activeRef = useRef<string>("Dragon_Flying");

  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    colorDragonModel(clone, colors, effects);
    clone.scale.set(0.3, 0.3, 0.3);
    clone.rotation.y = Math.PI * 0.8;
    clone.position.y = -0.5;
    return clone;
  }, [scene, colors, effects]);

  const { actions, mixer } = useAnimations(animations, groupRef);

  // Start flying on mount
  useEffect(() => {
    const flyAnim = actions["Dragon_Flying"] ?? Object.values(actions)[0];
    if (flyAnim) {
      flyAnim.reset().fadeIn(0.3).play();
      activeRef.current = "Dragon_Flying";
    }
  }, [actions]);

  // Play one-shot preview animation, then return to flying
  useEffect(() => {
    if (!previewAnim || !mixer) return;
    const anim = actions[previewAnim.name];
    const flyAnim = actions["Dragon_Flying"] ?? Object.values(actions)[0];
    if (!anim || !flyAnim) return;

    // Play the preview anim once
    anim.reset();
    anim.setLoop(THREE.LoopOnce, 1);
    anim.clampWhenFinished = false;
    anim.fadeIn(0.2).play();
    flyAnim.fadeOut(0.2);
    activeRef.current = previewAnim.name;

    // When it finishes, crossfade back to flying
    const onFinished = () => {
      flyAnim.reset().fadeIn(0.3).play();
      anim.fadeOut(0.3);
      activeRef.current = "Dragon_Flying";
    };
    mixer.addEventListener("finished", onFinished);
    return () => {
      mixer.removeEventListener("finished", onFinished);
    };
  }, [previewAnim, actions, mixer]);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
    </group>
  );
}

/* ---- Attack effect projectile for preview ---- */

function AttackPreviewEffect({
  attack,
  triggerKey,
}: {
  attack: DragonType["attack"];
  triggerKey: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(1); // 1 = done/hidden
  const spinRef = useRef(0);

  // Reset animation when triggerKey changes
  useEffect(() => {
    if (triggerKey > 0) {
      progressRef.current = 0;
      spinRef.current = 0;
    }
  }, [triggerKey]);

  useFrame((_, delta) => {
    if (!groupRef.current || progressRef.current >= 1) {
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;
    progressRef.current = Math.min(1, progressRef.current + delta * 1.2);
    const t = progressRef.current;

    // Fly from dragon mouth area toward camera
    groupRef.current.position.set(0, -0.1 + t * 0.3, t * 2.5);
    // Scale up then fade
    const scale = 0.6 + t * 0.4;
    groupRef.current.scale.setScalar(scale);

    // Spin the projectile
    spinRef.current += delta;
    groupRef.current.rotation.x = spinRef.current * 3;
    groupRef.current.rotation.z = spinRef.current * 2;

    // Fade out children materials
    groupRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material as THREE.Material;
        if (mat) {
          mat.transparent = true;
          mat.opacity = Math.max(0, 1 - t * t);
        }
      }
    });
  });

  const size = PROJECTILE_SIZE.PREVIEW * attack.projectileSize;

  return (
    <group ref={groupRef} visible={false}>
      <ProjectileMesh attack={attack} size={size} />
      {/* glow light follows the projectile */}
      <pointLight color={attack.color1} intensity={2} distance={3} />
    </group>
  );
}

function DragonPreview3D({
  dragon,
  previewAnim,
}: {
  dragon: DragonType;
  previewAnim?: { name: string; key: number };
}) {
  // Only trigger projectile for attack animations
  const attackTrigger =
    previewAnim?.name === "Dragon_Attack" ? previewAnim.key : 0;

  return (
    <Canvas
      camera={{ position: [0, 0.5, 3], fov: 40 }}
      style={{ background: "transparent" }}
      gl={{ alpha: true, antialias: true }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 2]} intensity={1.2} />
      <directionalLight
        position={[-2, 1, -1]}
        intensity={0.3}
        color="#8888ff"
      />
      <Suspense fallback={null}>
        <DragonModel
          colors={dragon.colors}
          effects={dragon.effects}
          previewAnim={previewAnim}
        />
        <AttackPreviewEffect
          attack={dragon.attack}
          triggerKey={attackTrigger}
        />
      </Suspense>
    </Canvas>
  );
}

/* ---- Stat Bar ---- */

function StatPip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const pct = Math.round((value / MAX_STAT) * 100);
  return (
    <div className="stat-pip">
      <div className="stat-pip-bar">
        <div
          className="stat-pip-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="stat-pip-label">{label}</span>
    </div>
  );
}

/* ---- Dragon Card (Bestiary Entry) ---- */

function DragonCard({
  dragon,
  isSelected,
  onClick,
  tribeAtmo,
}: {
  dragon: DragonType;
  isSelected: boolean;
  onClick: () => void;
  tribeAtmo: (typeof TRIBE_ATMOSPHERE)[string];
}) {
  const accentColor =
    dragon.colors.eye === "#1A1A1A" ? dragon.colors.body : dragon.colors.eye;
  const barColor = isSelected ? accentColor : tribeAtmo.accent;

  // Animation preview state — key increments to allow re-triggering the same anim
  const [previewAnim, setPreviewAnim] = useState<
    { name: string; key: number } | undefined
  >();
  const keyRef = useRef(0);

  const triggerAnim = useCallback((name: string, e: React.MouseEvent) => {
    e.stopPropagation(); // don't trigger card select
    keyRef.current += 1;
    setPreviewAnim({ name, key: keyRef.current });
  }, []);

  return (
    <div
      className={`dragon-card ${isSelected ? "selected" : ""}`}
      onClick={onClick}
      style={
        {
          "--card-accent": accentColor,
          "--card-body": dragon.colors.body,
          "--card-body-dark": dragon.colors.bodyDark,
          borderColor: isSelected ? accentColor + "88" : undefined,
          boxShadow: isSelected
            ? `0 0 40px ${accentColor}22, 0 0 80px ${dragon.colors.body}11, inset 0 0 60px ${dragon.colors.body}08`
            : "none",
        } as React.CSSProperties
      }
    >
      {/* Atmospheric glow behind dragon */}
      <div
        className="card-aura"
        style={{
          background: `radial-gradient(ellipse at 50% 30%, ${dragon.colors.body}20 0%, transparent 70%)`,
        }}
      />

      <div className="card-preview">
        <DragonPreview3D dragon={dragon} previewAnim={previewAnim} />
      </div>

      <h3
        className="card-name"
        style={{ color: isSelected ? accentColor : "#c8b89a" }}
      >
        {dragon.name}
      </h3>

      <span
        className="card-tribe-seal"
        style={{
          borderColor: tribeAtmo.accent + "44",
          color: tribeAtmo.accent,
        }}
      >
        {dragon.tribe.toUpperCase()}
      </span>

      <p className="card-description">{dragon.description}</p>

      <div className="card-abilities">
        <button
          type="button"
          className="card-ability-tag attack"
          onClick={(e) => triggerAnim("Dragon_Attack", e)}
          title="Preview attack animation"
        >
          {dragon.attack.style.replace("_", " ").toUpperCase()}
          {dragon.attack.count > 1 ? ` x${dragon.attack.count}` : ""}
        </button>
        <button
          type="button"
          className="card-ability-tag special"
          onClick={(e) => triggerAnim("Dragon_Attack2", e)}
          title="Preview special animation"
        >
          {dragon.special.label} ({dragon.special.cooldown}s)
        </button>
      </div>

      <div className="card-stats">
        <StatPip label="Speed" value={dragon.stats.speed} color={barColor} />
        <StatPip label="Fire" value={dragon.stats.firepower} color={barColor} />
        <StatPip
          label="Agility"
          value={dragon.stats.agility}
          color={barColor}
        />
        <StatPip label="Armor" value={dragon.stats.armor} color={barColor} />
      </div>
    </div>
  );
}

/* ---- Main Select Screen ---- */

export default function DragonSelect({
  onSelect,
}: {
  onSelect: (dragon: DragonType) => void;
}) {
  const [selectedTribe, setSelectedTribe] = useState<string>("pyrrhia");
  const [selectedDragon, setSelectedDragon] = useState<DragonType>(
    DRAGON_TYPES[0],
  );
  const carouselRef = useRef<HTMLDivElement>(null);
  const atmo = TRIBE_ATMOSPHERE[selectedTribe] ?? TRIBE_ATMOSPHERE.pyrrhia;

  const tribeDragons = DRAGON_TYPES.filter((d) => d.tribe === selectedTribe);

  useEffect(() => {
    const first = DRAGON_TYPES.find((d) => d.tribe === selectedTribe);
    if (first) setSelectedDragon(first);
    if (carouselRef.current) {
      carouselRef.current.scrollTo({ left: 0, behavior: "smooth" });
    }
  }, [selectedTribe]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        onSelect(selectedDragon);
        return;
      }
      const idx = tribeDragons.findIndex((d) => d.id === selectedDragon.id);
      if (e.key === "ArrowRight" && idx < tribeDragons.length - 1) {
        setSelectedDragon(tribeDragons[idx + 1]);
      } else if (e.key === "ArrowLeft" && idx > 0) {
        setSelectedDragon(tribeDragons[idx - 1]);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedDragon, tribeDragons, onSelect]);

  const accentColor =
    selectedDragon.colors.eye === "#1A1A1A"
      ? selectedDragon.colors.body
      : selectedDragon.colors.eye;

  return (
    <div
      className="select-screen"
      style={
        {
          "--atmo-bg1": atmo.bg1,
          "--atmo-bg2": atmo.bg2,
          "--atmo-bg3": atmo.bg3,
          "--atmo-glow": atmo.glow,
          "--atmo-glow-alpha": atmo.glowAlpha,
          "--atmo-accent": atmo.accent,
        } as React.CSSProperties
      }
    >
      {/* Atmospheric edge glow */}
      <div className="atmo-vignette" />

      <div className="select-header">
        <p className="select-realm">{atmo.subtitle}</p>
        <h1 className="select-title">Choose Your Dragon</h1>
      </div>

      <div className="tribe-tabs">
        {TRIBES.map((tribe) => {
          const isActive = selectedTribe === tribe.id;
          const tAtmo = TRIBE_ATMOSPHERE[tribe.id] ?? TRIBE_ATMOSPHERE.pyrrhia;
          return (
            <button
              key={tribe.id}
              type="button"
              className={`tribe-tab ${isActive ? "active" : ""}`}
              onClick={() => setSelectedTribe(tribe.id)}
              style={
                isActive
                  ? {
                      borderColor: tAtmo.accent,
                      color: tAtmo.accent,
                      background: tAtmo.accent + "14",
                    }
                  : undefined
              }
            >
              <span className="tribe-tab-name">{tribe.name}</span>
            </button>
          );
        })}
      </div>

      <div className="dragon-carousel" ref={carouselRef}>
        {tribeDragons.map((dragon) => (
          <DragonCard
            key={dragon.id}
            dragon={dragon}
            isSelected={selectedDragon.id === dragon.id}
            onClick={() => setSelectedDragon(dragon)}
            tribeAtmo={atmo}
          />
        ))}
      </div>

      <div className="select-bottom">
        <span className="key-hint">ARROW KEYS TO BROWSE</span>
        <button
          type="button"
          className="fly-button"
          onClick={() => onSelect(selectedDragon)}
          style={
            {
              "--btn-color": selectedDragon.colors.body,
              "--btn-dark": selectedDragon.colors.bodyDark,
              "--btn-glow": accentColor,
            } as React.CSSProperties
          }
        >
          <span className="fly-button-text">Fly as {selectedDragon.name}</span>
        </button>
        <span className="key-hint">ENTER TO SELECT</span>
      </div>
    </div>
  );
}
