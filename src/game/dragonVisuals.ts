export type SilhouetteFamily = "armored" | "barbed" | "finned" | "spined" | "frilled" | "swift";

export function silhouetteFamily(id: string): SilhouetteFamily {
  if (["mudwing", "ricewing"].includes(id)) return "armored";
  if (["sandwing", "hivewing", "hivewing2", "bladewing"].includes(id)) return "barbed";
  if (id === "seawing") return "finned";
  if (["icewing", "nightwing", "bonewing"].includes(id)) return "spined";
  if (["rainwing", "leafwing", "silkwing"].includes(id)) return "frilled";
  return "swift";
}
