/**
 * Free-flight health. Rival fire wears it down; it refills after a few quiet seconds.
 * At zero you are knocked out of the sky: you drop your treasure and wake at your hoard.
 */
export interface Vitality { hp: number; max: number; lastHit: number; down: boolean }

export const VITALITY = { max: 100, regenDelay: 5, regenRate: 9, minArmor: 0.5 };

export const createVitality = (): Vitality => ({ hp: VITALITY.max, max: VITALITY.max, lastHit: -Infinity, down: false });

/** Armored tribes shrug off more of each hit. A barrel roll (invulnerable) dodges it entirely. */
export function damageVitality(vitality: Vitality, damage: number, armor: number, now: number, invulnerable = false) {
  if (vitality.down || invulnerable || !(damage > 0)) return { vitality, knockedOut: false };
  const taken = damage / Math.max(VITALITY.minArmor, Number.isFinite(armor) ? armor : 1);
  const hp = Math.max(0, vitality.hp - taken);
  return { vitality: { ...vitality, hp, lastHit: now, down: hp <= 0 }, knockedOut: hp <= 0 };
}

export function regenerateVitality(vitality: Vitality, now: number, delta: number): Vitality {
  if (vitality.down || vitality.hp >= vitality.max || now - vitality.lastHit < VITALITY.regenDelay) return vitality;
  return { ...vitality, hp: Math.min(vitality.max, vitality.hp + VITALITY.regenRate * Math.max(0, delta)) };
}

export const reviveVitality = (vitality: Vitality): Vitality => ({ ...vitality, hp: vitality.max, down: false, lastHit: -Infinity });
