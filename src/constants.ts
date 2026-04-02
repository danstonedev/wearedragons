/** Animation clip names available in dragon.glb */
export const ANIM = {
  FLYING: "Dragon_Flying",
  ATTACK: "Dragon_Attack",
  ATTACK2: "Dragon_Attack2",
  HIT: "Dragon_Hit",
  DEATH: "Dragon_Death",
} as const;

/** Projectile & combat tuning */
export const COMBAT = {
  BASE_FIRE_VELOCITY: 50,
  MUZZLE_OFFSET: [0, 1.2, -3] as const,
  TOWER_HIT_RADIUS_SQ: 16, // squared distance for tower hit detection
  PLAYER_HIT_RADIUS_SQ: 6.25, // 2.5² — enemy projectile vs player
  TOWER_SHOOT_RANGE: 60,
  TOWER_SHOOT_SPEED: 25,
  TOWER_SHOOT_INTERVAL: 2, // seconds
  TOWER_HIT_DAMAGE: 35,
  ENEMY_HIT_DAMAGE: 12,
  SCATTER_COUNT: 8,
  SCATTER_SPEED: 40,
  SLAM_SCATTER_SPEED: 30,
  UPDRAFT_VELOCITY: 40,
  SLAM_VELOCITY: -60,
} as const;

/** Projectile size multipliers */
export const PROJECTILE_SIZE = {
  GAMEPLAY: 0.6,
  PREVIEW: 0.25,
} as const;

/** Dragon physics */
export const DRAGON = {
  SCALE: 0.8,
  PREVIEW_SCALE: 0.3,
  MIN_ALTITUDE: 1.2,
  GROUND_THRESHOLD: 0.2, // added to MIN_ALTITUDE for grounded check
  CAMERA_OFFSET: [0, 3, 7] as const,
  CAMERA_LOOK_OFFSET_Y: 1.5,
} as const;

/** Maximum stat value for bar display */
export const MAX_STAT = 1.5;
