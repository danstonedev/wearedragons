export type SilhouetteFamily = "armored" | "barbed" | "finned" | "spined" | "frilled" | "swift";

export interface DragonAttachment {
  bone: "Head" | "Neck" | "Body" | "Tail1" | "Tail2" | "Tail3" | "Tail4";
  shape: "cone" | "plate" | "fin";
  material: "spike" | "horn";
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

function part(
  bone: DragonAttachment["bone"], shape: DragonAttachment["shape"],
  position: DragonAttachment["position"], rotation: DragonAttachment["rotation"],
  scale: DragonAttachment["scale"], material: DragonAttachment["material"] = "spike",
): DragonAttachment {
  return { bone, shape, material, position, rotation, scale };
}

export function silhouetteFamily(id: string): SilhouetteFamily {
  if (["mudwing", "ricewing"].includes(id)) return "armored";
  if (["sandwing", "hivewing", "hivewing2", "bladewing"].includes(id)) return "barbed";
  if (id === "seawing") return "finned";
  if (["icewing", "nightwing", "bonewing"].includes(id)) return "spined";
  if (["rainwing", "leafwing", "silkwing"].includes(id)) return "frilled";
  return "swift";
}

/** Composite model pieces positioned in each named bone's local coordinate space. */
export function dragonAttachmentPlan(id: string): DragonAttachment[] {
  switch (silhouetteFamily(id)) {
    case "armored":
      return [
        part("Body", "plate", [0, 0.2, 0], [0, 0, Math.PI / 4], [0.65, 0.28, 0.42]),
        part("Tail1", "plate", [0, 0.16, 0], [0, 0, Math.PI / 4], [0.5, 0.23, 0.34]),
        part("Tail2", "plate", [0, 0.12, 0], [0, 0, Math.PI / 4], [0.38, 0.18, 0.27]),
      ];
    case "barbed":
      return [
        part("Head", "cone", [-0.28, 0.25, 0.08], [Math.PI / 2, 0, -0.2], [0.3, 0.62, 0.3], "horn"),
        part("Head", "cone", [0.28, 0.25, 0.08], [Math.PI / 2, 0, 0.2], [0.3, 0.62, 0.3], "horn"),
        part("Tail4", "cone", [0, 0, -0.32], [-Math.PI / 2, 0, 0], [0.5, 0.8, 0.5]),
      ];
    case "finned":
      return [
        part("Neck", "fin", [0, 0.22, 0], [0, 0, 0], [0.2, 0.48, 0.55]),
        part("Body", "fin", [0, 0.28, 0], [0, 0, 0], [0.25, 0.62, 0.72]),
        part("Tail1", "fin", [0, 0.19, 0], [0, 0, 0], [0.18, 0.48, 0.6]),
        part("Tail2", "fin", [0, 0.13, 0], [0, 0, 0], [0.14, 0.37, 0.48]),
      ];
    case "spined":
      return [
        part("Neck", "cone", [0, 0.2, 0], [0, 0, 0], [0.23, 0.46, 0.23]),
        part("Body", "cone", [0, 0.25, 0], [0, 0, 0], [0.3, 0.62, 0.3]),
        part("Tail1", "cone", [0, 0.18, 0], [0, 0, 0], [0.22, 0.45, 0.22]),
        part("Tail2", "cone", [0, 0.14, 0], [0, 0, 0], [0.17, 0.36, 0.17]),
        part("Tail3", "cone", [0, 0.1, 0], [0, 0, 0], [0.13, 0.28, 0.13]),
      ];
    case "frilled":
      return [
        part("Head", "fin", [-0.27, 0.05, 0], [0, 0, Math.PI / 2], [0.17, 0.5, 0.38]),
        part("Head", "fin", [0.27, 0.05, 0], [0, 0, -Math.PI / 2], [0.17, 0.5, 0.38]),
        part("Neck", "fin", [0, 0.2, 0], [0, 0, 0], [0.18, 0.43, 0.5]),
      ];
    case "swift":
      return [
        part("Head", "cone", [-0.22, 0.2, 0.08], [Math.PI / 2, 0, -0.35], [0.22, 0.52, 0.22], "horn"),
        part("Head", "cone", [0.22, 0.2, 0.08], [Math.PI / 2, 0, 0.35], [0.22, 0.52, 0.22], "horn"),
      ];
  }
}
