import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { raidActions, raidTouch } from "./raidState";

/** Left thumb moves; right thumb sneaks, runs, grabs, throws, and drops. */
export default function RaidTouchControls() {
  const base = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ x: 0, y: 0 });
  const [sneak, setSneak] = useState(raidTouch.sneak);
  useEffect(() => () => { Object.assign(raidTouch, { x: 0, y: 0, sprint: false }); }, []);
  const update = useCallback((event: ReactPointerEvent) => {
    if (!base.current) return;
    const rect = base.current.getBoundingClientRect();
    const max = rect.width / 2;
    let dx = event.clientX - (rect.left + max), dy = event.clientY - (rect.top + max);
    const length = Math.hypot(dx, dy);
    if (length > max) { dx *= max / length; dy *= max / length; }
    setThumb({ x: dx, y: dy });
    const nx = dx / max, ny = dy / max;
    raidTouch.x = Math.abs(nx) > 0.12 ? nx : 0;
    raidTouch.y = Math.abs(ny) > 0.12 ? ny : 0;
  }, []);
  const release = useCallback((event: ReactPointerEvent) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setThumb({ x: 0, y: 0 });
    raidTouch.x = raidTouch.y = 0;
  }, []);
  const tap = (action: keyof typeof raidActions) => (event: ReactPointerEvent) => { event.stopPropagation(); raidActions[action] = true; };
  return <div className="raid-touch">
    <div className="raid-stick" ref={base}
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); update(event); }}
      onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event); }}
      onPointerUp={release} onPointerCancel={release}>
      <div className="raid-stick-thumb" style={{ transform: `translate(calc(-50% + ${thumb.x}px), calc(-50% + ${thumb.y}px))` }} />
    </div>
    <div className="raid-buttons">
      <button type="button" className={sneak ? "on" : ""} onPointerDown={event => { event.stopPropagation(); raidTouch.sneak = !raidTouch.sneak; setSneak(raidTouch.sneak); }}>SNEAK</button>
      <button type="button" onPointerDown={event => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); raidTouch.sprint = true; }}
        onPointerUp={() => { raidTouch.sprint = false; }} onPointerCancel={() => { raidTouch.sprint = false; }} onLostPointerCapture={() => { raidTouch.sprint = false; }}>RUN</button>
      <button type="button" className="grab" onPointerDown={tap("grab")}>GRAB</button>
      <button type="button" onPointerDown={tap("pebble")}>PEBBLE</button>
      <button type="button" onPointerDown={tap("drop")}>DROP</button>
    </div>
  </div>;
}
