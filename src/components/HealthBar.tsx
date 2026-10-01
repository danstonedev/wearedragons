export default function HealthBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = Math.max(0, (hp / maxHp) * 100);
  const color = pct > 50 ? "#44ff88" : pct > 25 ? "#ffc107" : "#ff4444";
  return (
    <div className="health-bar-container">
      <div className="health-bar-track">
        <div
          className="health-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="health-bar-label" style={{ color }}>
        HP {Math.ceil(hp)}/{maxHp}
      </div>
    </div>
  );
}
