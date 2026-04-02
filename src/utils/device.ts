/* ============================================================
   Device Detection — iPad / iPhone / Desktop
   ============================================================ */

export type DeviceClass = "iphone" | "ipad" | "mobile" | "desktop";

function detect(): DeviceClass {
  const ua = navigator.userAgent;

  // iPad: explicit "iPad" in UA, or modern iPadOS (reports as Macintosh but has touch)
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1))
    return "ipad";

  if (/iPhone/.test(ua)) return "iphone";

  // Other touch devices (Android phones/tablets)
  if (navigator.maxTouchPoints > 0 && window.innerWidth < 1024) return "mobile";

  return "desktop";
}

/** Detected once at module load — won't change during session. */
export const device: DeviceClass = detect();

/** True on any touch-primary device (iPhone, iPad, Android). */
export const isTouchDevice: boolean = device !== "desktop";

/** True specifically on Apple mobile hardware. */
export const isIOS: boolean = device === "iphone" || device === "ipad";

/* ---- Per-device tuning presets ---- */

export interface DevicePreset {
  /** Max DPR for the Three.js Canvas renderer */
  maxDpr: number;
  /** Shadow map resolution */
  shadowMapSize: number;
  /** Default joystick maxDist (px) — larger screen = larger stick */
  joystickMaxDist: number;
  /** Whether touch controls should auto-show */
  showTouchControls: boolean;
}

const PRESETS: Record<DeviceClass, DevicePreset> = {
  iphone: {
    maxDpr: 2, // iPhone 3x is too expensive for realtime 3D; cap at 2
    shadowMapSize: 1024,
    joystickMaxDist: 60,
    showTouchControls: true,
  },
  ipad: {
    maxDpr: 2,
    shadowMapSize: 2048,
    joystickMaxDist: 80, // plenty of screen real-estate
    showTouchControls: true,
  },
  mobile: {
    maxDpr: 1.5,
    shadowMapSize: 1024,
    joystickMaxDist: 64,
    showTouchControls: true,
  },
  desktop: {
    maxDpr: 1.5,
    shadowMapSize: 2048,
    joystickMaxDist: 68,
    showTouchControls: false,
  },
};

export const preset: DevicePreset = PRESETS[device];
