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
}) {
  return (
    <label className={labelClass}>
      {label}
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
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className={labelClass}>
      {label}
      <textarea className={textareaClass} name={name} placeholder={placeholder} required={required} />
    </label>
  );
}

export function Select({
  label,
  name,
  required,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={labelClass}>
      {label}
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
