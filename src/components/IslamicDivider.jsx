import './IslamicDivider.css';

// Each divider variant has a different color scheme and Arabic text style
const VARIANTS = [
  { bg: 'linear-gradient(90deg, #0f3d25, #1a5c38, #0f3d25)', color: '#f0d080', border: 'rgba(201,168,76,0.4)' },
  { bg: 'linear-gradient(90deg, #1a4a1a, #2d7a2d, #1a4a1a)', color: '#ffe599', border: 'rgba(255,229,153,0.35)' },
  { bg: 'linear-gradient(90deg, #2c1810, #5c3420, #2c1810)', color: '#f0d080', border: 'rgba(201,168,76,0.4)' },
  { bg: 'linear-gradient(90deg, #0d2b4a, #1a5080, #0d2b4a)', color: '#a8d8f0', border: 'rgba(168,216,240,0.35)' },
  { bg: 'linear-gradient(90deg, #1a1a2e, #2d2d5e, #1a1a2e)', color: '#c9a84c', border: 'rgba(201,168,76,0.4)' },
  { bg: 'linear-gradient(90deg, #0f3d25, #0d2b4a, #0f3d25)', color: '#f0d080', border: 'rgba(201,168,76,0.35)' },
];

export default function IslamicDivider({ texts = [], variant = 0 }) {
  if (!texts || texts.length === 0) return null;
  const v = VARIANTS[variant % VARIANTS.length];
  // Duplicate texts for seamless loop
  const items = [...texts, ...texts, ...texts];

  return (
    <div className="isl-divider" style={{ background: v.bg, borderTop: `1px solid ${v.border}`, borderBottom: `1px solid ${v.border}` }}>
      <div className="isl-track" style={{ animationDuration: `${Math.max(20, texts.length * 8)}s` }}>
        {items.map((t, i) => (
          <span key={i} className={`isl-item isl-style-${(i % 4)}`} style={{ color: v.color }}>
            {t}
            <span className="isl-sep" style={{ color: v.border }}>✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
