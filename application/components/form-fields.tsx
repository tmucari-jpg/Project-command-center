import {
  inputClass,
  selectClass,
  textareaClass,
} from "@/components/ui";

const labelClass = "block text-sm font-semibold text-[var(--cc-foreground)]";

export function Field({
  label,
  name,
  type = "text",
  required,
  min,
  max,
  step,
  placeholder,
  defaultValue,
  help,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  placeholder?: string;
  defaultValue?: string | number;
  help?: string;
}) {
  return (
    <label className={labelClass}>
      {label}
      {help && <span className="mt-1 block text-xs font-normal leading-5 text-[var(--cc-secondary)]">{help}</span>}
      <input
        className={inputClass}
        name={name}
        type={type}
        required={required}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        defaultValue={defaultValue}
      />
    </label>
  );
}

export function TextArea({
  label,
  name,
  placeholder,
  required,
  defaultValue,
  help,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  help?: string;
}) {
  return (
    <label className={labelClass}>
      {label}
      {help && <span className="mt-1 block text-xs font-normal leading-5 text-[var(--cc-secondary)]">{help}</span>}
      <textarea className={textareaClass} name={name} placeholder={placeholder} required={required} defaultValue={defaultValue} />
    </label>
  );
}

export function Select({
  label,
  name,
  required,
  defaultValue,
  children,
  help,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  children: React.ReactNode;
  help?: string;
}) {
  return (
    <label className={labelClass}>
      {label}
      {help && <span className="mt-1 block text-xs font-normal leading-5 text-[var(--cc-secondary)]">{help}</span>}
      <select
        className={selectClass}
        name={name}
        required={required}
        defaultValue={defaultValue}
      >
        {children}
      </select>
    </label>
  );
}
