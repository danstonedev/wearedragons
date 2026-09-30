import { createXRStore } from "@react-three/xr";

export const xrStore = createXRStore({
  emulate: false,
  offerSession: false,
  enterGrantedSession: false,
  hand: false,
  controller: false,
  gaze: false,
  transientPointer: false,
  screenInput: false,
  foveation: 1,
  frameRate: supported => {
    const rates = Array.from(supported);
    return rates.length ? rates.includes(72) ? 72 : Math.min(...rates) : false;
  },
  frameBufferScaling: 0.8,
});
