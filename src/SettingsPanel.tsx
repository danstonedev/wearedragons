import { useState, useCallback } from "react";
import {
  settings,
  saveSettings,
  resetSettings,
  CONTROL_DEFAULTS,
} from "./controls/ControlSettings";
import type { ControlSettings } from "./controls/ControlSettings";
import "./SettingsPanel.css";

function Slider({
  label,
  value,
  min = 0.2,
  max = 2.0,
  step = 0.1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="sp-slider-row">
      <span className="sp-slider-label">{label}</span>
      <input
        type="range"
        className="sp-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={
          {
            "--fill-pct": `${pct}%`,
          } as React.CSSProperties
        }
      />
      <span className="sp-slider-value">{value.toFixed(1)}</span>
    </div>
  );
}

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  // Local copy so sliders re-render; writes go to the shared settings object too
  const [local, setLocal] = useState<ControlSettings>({ ...settings });

  const update = useCallback((partial: Partial<ControlSettings>) => {
    saveSettings(partial);
    setLocal({ ...settings });
  }, []);

  const handleReset = useCallback(() => {
    resetSettings();
    setLocal({ ...CONTROL_DEFAULTS });
  }, []);

  return (
    <div className="sp-backdrop" onPointerDown={onClose}>
      <div className="sp-panel" onPointerDown={(e) => e.stopPropagation()}>
        <h2 className="sp-title">Controls</h2>

        {/* ---- Control scheme toggle ---- */}
        <div className="sp-section">
          <span className="sp-section-label">Control Style</span>
          <div className="sp-scheme-btns">
            <button
              type="button"
              className={`sp-scheme-btn ${local.scheme === "joystick" ? "active" : ""}`}
              onClick={() => update({ scheme: "joystick" })}
            >
              <span className="sp-scheme-icon">&#x1F579;</span>
              <span>Joystick</span>
              <span className="sp-scheme-desc">Analogue stick</span>
            </button>
            <button
              type="button"
              className={`sp-scheme-btn ${local.scheme === "buttons" ? "active" : ""}`}
              onClick={() => update({ scheme: "buttons" })}
            >
              <span className="sp-scheme-icon">&#x271A;</span>
              <span>D-Pad</span>
              <span className="sp-scheme-desc">Big arrow buttons</span>
            </button>
          </div>
        </div>

        {/* ---- Sensitivity sliders ---- */}
        <div className="sp-section">
          <span className="sp-section-label">Sensitivity</span>

          <Slider
            label="Turn"
            value={local.turnSensitivity}
            onChange={(v) => update({ turnSensitivity: v })}
          />
          <Slider
            label="Climb / Dive"
            value={local.climbSensitivity}
            onChange={(v) => update({ climbSensitivity: v })}
          />
          <Slider
            label="Speed"
            value={local.speedSensitivity}
            onChange={(v) => update({ speedSensitivity: v })}
          />
        </div>

        {/* ---- Actions ---- */}
        <div className="sp-actions">
          <button type="button" className="sp-reset-btn" onClick={handleReset}>
            Reset Defaults
          </button>
          <button type="button" className="sp-close-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
