import './Card.css';

export default function Card({ title, value, icon, color = 'primary', subtitle }) {
  return (
    <div className={`stat-card stat-card-${color}`}>
      <div className="stat-card-content">
        <div className="stat-card-info">
          <p className="stat-card-title">{title}</p>
          <p className="stat-card-value">{value}</p>
          {subtitle && <p className="stat-card-subtitle">{subtitle}</p>}
        </div>
        <div className="stat-card-icon">{icon}</div>
      </div>
    </div>
  );
}
