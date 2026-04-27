import './Button.css';

export default function Button({ children, variant = 'primary', size = 'md', onClick, type = 'button', disabled, fullWidth, icon }) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size}${fullWidth ? ' btn-full' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <span className="btn-icon">{icon}</span>}
      {children}
    </button>
  );
}
