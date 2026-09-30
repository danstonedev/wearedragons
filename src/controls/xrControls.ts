export interface XRControllerSample {
  handedness: string;
  gamepad?: { mapping: string; axes: readonly number[]; buttons: readonly { pressed: boolean }[] } | null;
}

export function deadzone(value: number, threshold = 0.18) {
  if (!Number.isFinite(value) || Math.abs(value) <= threshold) return 0;
  return Math.sign(value) * Math.min(1, (Math.abs(value) - threshold) / (1 - threshold));
}

export function readXRControls(sources: readonly XRControllerSample[]) {
  const input = { throttle: 0, climb: 0, fire: false, special: false, snap: 0, pause: false, exit: false, brake: false, glide: false };
  for (const source of sources) {
    const pad = source.gamepad;
    // Only the documented xr-standard layout is supported; don't guess other layouts.
    if (!pad || pad.mapping !== "xr-standard") continue;
    if (source.handedness === "left") {
      input.brake = pad.buttons[1]?.pressed ?? false;
      input.throttle = pad.buttons[1]?.pressed ? 0 : -deadzone(pad.axes[3] ?? 0);
      input.special = pad.buttons[0]?.pressed ?? false;
      input.pause = pad.buttons[4]?.pressed ?? false;
      input.exit = pad.buttons[5]?.pressed ?? false;
    } else if (source.handedness === "right") {
      input.glide = pad.buttons[1]?.pressed ?? false;
      input.climb = -deadzone(pad.axes[3] ?? 0);
      input.snap = deadzone(pad.axes[2] ?? 0, 0.6);
      input.fire = pad.buttons[0]?.pressed ?? false;
    }
  }
  return input;
}

export interface XREdges { special: boolean; snap: boolean; pause: boolean; exit: boolean }
export function controllerEdges(previous: XREdges, controls: ReturnType<typeof readXRControls>) {
  const next = { special: controls.special, snap: controls.snap !== 0, pause: controls.pause, exit: controls.exit };
  return {
    next,
    special: next.special && !previous.special,
    snap: next.snap && !previous.snap,
    pause: next.pause && !previous.pause,
    exit: next.exit && !previous.exit,
  };
}
