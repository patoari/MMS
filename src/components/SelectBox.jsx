import './SelectBox.css';

export default function SelectBox({ label, name, options = [], register, error, required, value, onChange }) {
  const selectProps = register ? register(name, { required: required ? `${label} আবশ্যক` : false }) : { value, onChange, name };

  return (
    <div className="select-group">
      {label && <label className="select-label">{label}{required && <span className="required">*</span>}</label>}
      <select className={`select-field${error ? ' select-error' : ''}`} {...selectProps}>
        <option value="">-- নির্বাচন করুন --</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <span className="select-error-msg">{error.message || error}</span>}
    </div>
  );
}
