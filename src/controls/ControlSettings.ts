/* ============================================================
   Control Settings — persisted to localStorage
   ============================================================ */

import { device } from "../utils/device";
import type { DeviceClass } from "../utils/device";

export interface ControlSettings {
  /** 'joystick' = analogue stick (default), 'buttons' = D-pad for young kids */
  scheme: "joystick" | "buttons";
  /** Turn rate multiplier (0.3 – 2.0) */
  turnSensitivity: number;
  /** Climb / dive rate multiplier (0.3 – 2.0) */
  climbSensitivity: number;
  /** Forward-speed multiplier (0.3 – 2.0) */
  speedSensitivity: number;
}

/** Device-tuned defaults — iPhones get D-pad + gentler sensitivity by default. */
const DEVICE_DEFAULTS: Record<DeviceClass, ControlSettings> = {
  iphone: {
    scheme: "buttons", // D-pad is easier on small screens
    turnSensitivity: 0.8,
    climbSensitivity: 0.4,
    speedSensitivity: 0.9,
  },
  ipad: {
    scheme: "joystick", // iPad has room for the bigger joystick
    turnSensitivity: 1.0,
    climbSensitivity: 0.5,
    speedSensitivity: 1.0,
  },
  mobile: {
    scheme: "buttons",
    turnSensitivity: 0.8,
    climbSensitivity: 0.4,
    speedSensitivity: 0.9,
  },
  desktop: {
    scheme: "joystick",
    turnSensitivity: 1.0,
    climbSensitivity: 0.5,
    speedSensitivity: 1.0,
  },
};

const DEFAULTS: ControlSettings = DEVICE_DEFAULTS[device];

const STORAGE_KEY = "dragon_control_settings";

/** Shared mutable settings object — read every frame, just like `joy` / `keys`. */
export const settings: ControlSettings = { ...DEFAULTS };

export function loadSettings(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        Object.assign(settings, parsed);
      }
    }
  } catch {
    // corrupt data — keep defaults
  }
}

export function saveSettings(partial: Partial<ControlSettings>): void {
  Object.assign(settings, partial);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function resetSettings(): void {
  Object.assign(settings, DEFAULTS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export { DEFAULTS as CONTROL_DEFAULTS };

// Auto-load on first import
loadSettings();
