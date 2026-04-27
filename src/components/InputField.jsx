import './InputField.css';

export default function InputField({ label, name, type = 'text', placeholder, register, registerOptions, error, required, value, onChange, readOnly }) {
  const inputProps = register
    ? register(name, registerOptions || { required: required ? `${label} আবশ্যক` : false })
    : { value, onChange, name };

  return (
    <div className="input-group">
      {label && <label className="input-label">{label}{required && <span className="required">*</span>}</label>}
      <input
        type={type}
        placeholder={placeholder}
        className={`input-field${error ? ' input-error' : ''}`}
        readOnly={readOnly}
        {...inputProps}
      />
      {error && <span className="input-error-msg">{error.message || error}</span>}
    </div>
  );
}
