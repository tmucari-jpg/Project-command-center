import {
  inputClass,
  selectClass,
  textareaClass,
} from "@/components/ui";

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
    <label className="block text-sm font-medium text-slate-700">
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
}: {
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <textarea className={textareaClass} name={name} placeholder={placeholder} />
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
    <label className="block text-sm font-medium text-slate-700">
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
