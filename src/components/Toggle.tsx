interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
}

/**
 * Slide-switch toggle. Renders a `.toggle-switch` button (the existing CSS
 * from style.css handles all visual styling). When `label` or `description`
 * are provided the component wraps everything in a `.appearance-toggle-row`
 * so it can be dropped straight into a settings list.
 */
export function Toggle({
  checked,
  onChange,
  disabled,
  label,
  description,
}: ToggleProps) {
  const btn = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`toggle-switch${checked ? " active" : ""}${disabled ? " disabled" : ""}`}
      onClick={() => !disabled && onChange(!checked)}
    />
  );

  if (!label) return btn;

  return (
    <label className="appearance-toggle-row">
      <div className="appearance-toggle-text">
        <div className="appearance-toggle-title">{label}</div>
        {description && (
          <div className="appearance-toggle-desc">{description}</div>
        )}
      </div>
      {btn}
    </label>
  );
}
