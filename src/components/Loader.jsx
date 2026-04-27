import './Loader.css';

export default function Loader({ text = 'লোড হচ্ছে...' }) {
  return (
    <div className="loader-container">
      <div className="loader-spinner"></div>
      <p className="loader-text">{text}</p>
    </div>
  );
}
