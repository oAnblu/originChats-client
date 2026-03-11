interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
}

export function Checkbox({
  checked,
  onChange,
  disabled,
  label,
  description,
}: CheckboxProps) {
  const input = (
    <label className={`checkbox-root${disabled ? " disabled" : ""}`}>
      <input
        type="checkbox"
        className="checkbox-input"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
      />
      <span className="checkbox-box" aria-hidden="true" />
    </label>
  );

  if (!label) return input;

  return (
    <label className="appearance-toggle-row">
      <div className="appearance-toggle-text">
        <div className="appearance-toggle-title">{label}</div>
        {description && (
          <div className="appearance-toggle-desc">{description}</div>
        )}
      </div>
      {input}
    </label>
  );
}
