import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useEffect, useId, useRef, useState } from "react";

type BaseProps = {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
  required?: boolean;
};

type FieldLayoutProps = {
  fieldClassName?: string;
  labelHidden?: boolean;
};

function useFieldId(id: string | undefined, label: string) {
  const generated = useId();
  return id ?? `${label.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-")}-${generated.replaceAll(":", "")}`;
}

function FieldLabel({ id, label, required, hidden = false }: { id: string; label: string; required?: boolean; hidden?: boolean }) {
  return (
    <label className={`form-field-label${hidden ? " sr-only" : ""}`} htmlFor={id}>
      <span>{label}{required && <span className="required-mark" aria-hidden="true">*</span>}</span>
    </label>
  );
}

function FieldMessage({ id, hint, error }: Pick<BaseProps, "hint" | "error"> & { id: string }) {
  if (!hint && !error) return null;
  return <small id={id} className={error ? "form-field-error" : "form-field-hint"}>{error ?? hint}</small>;
}

export function FormField({ label, hint, error, id, required, labelHidden, className = "", children }: BaseProps & { className?: string; labelHidden?: boolean; children: ReactNode }) {
  const controlId = useFieldId(id, label);
  const messageId = `${controlId}-message`;
  return (
    <div className={`form-field ${className}`.trim()}>
      <FieldLabel id={controlId} label={label} required={required} hidden={labelHidden} />
      {children}
      <FieldMessage id={messageId} hint={hint} error={error} />
    </div>
  );
}

export function TextField({ label, hint, error, id, required, fieldClassName, labelHidden, ...props }: BaseProps & FieldLayoutProps & InputHTMLAttributes<HTMLInputElement>) {
  const controlId = useFieldId(id, label);
  const messageId = `${controlId}-message`;
  const describedBy = [props["aria-describedby"], hint || error ? messageId : undefined].filter(Boolean).join(" ") || undefined;
  return (
    <FormField className={fieldClassName} label={label} hint={hint} error={error} id={controlId} required={required} labelHidden={labelHidden}>
      <input {...props} id={controlId} required={required} aria-invalid={error ? "true" : undefined} aria-describedby={describedBy} />
    </FormField>
  );
}

export function TextareaField({ label, hint, error, id, required, fieldClassName, labelHidden, ...props }: BaseProps & FieldLayoutProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const controlId = useFieldId(id, label);
  const messageId = `${controlId}-message`;
  const describedBy = [props["aria-describedby"], hint || error ? messageId : undefined].filter(Boolean).join(" ") || undefined;
  return (
    <FormField className={fieldClassName} label={label} hint={hint} error={error} id={controlId} required={required} labelHidden={labelHidden}>
      <textarea {...props} id={controlId} required={required} aria-invalid={error ? "true" : undefined} aria-describedby={describedBy} />
    </FormField>
  );
}

export function SelectField({ label, hint, error, id, required, fieldClassName, labelHidden, children, ...props }: BaseProps & FieldLayoutProps & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const controlId = useFieldId(id, label);
  const messageId = `${controlId}-message`;
  const describedBy = [props["aria-describedby"], hint || error ? messageId : undefined].filter(Boolean).join(" ") || undefined;
  return (
    <FormField className={fieldClassName} label={label} hint={hint} error={error} id={controlId} required={required} labelHidden={labelHidden}>
      <select {...props} id={controlId} required={required} aria-invalid={error ? "true" : undefined} aria-describedby={describedBy}>{children}</select>
    </FormField>
  );
}

export function CheckboxField({ label, hint, error, id, required, ...props }: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  const controlId = useFieldId(id, label);
  const messageId = `${controlId}-message`;
  return (
    <div className="form-checkbox-field">
      <label htmlFor={controlId}>
        <input {...props} id={controlId} type="checkbox" required={required} aria-invalid={error ? "true" : undefined} aria-describedby={hint || error ? messageId : undefined} />
        <span>{label}{required && <span className="required-mark" aria-hidden="true">*</span>}</span>
      </label>
      <FieldMessage id={messageId} hint={hint} error={error} />
    </div>
  );
}

const DEFAULT_WEEKDAYS = [
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terça-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
];

export function WeekdayCheckboxGroup({
  name = "weekdays",
  label = "Dias em que o paciente vem",
  defaultValue = [],
  maxSelections = 3,
  required = false,
  disabled = false,
}: {
  name?: string;
  label?: string;
  defaultValue?: string[];
  maxSelections?: number;
  required?: boolean;
  disabled?: boolean;
}) {
  const generatedId = useId().replaceAll(":", "");
  const groupRef = useRef<HTMLFieldSetElement>(null);
  const [selected, setSelected] = useState(() => [...defaultValue]);
  const defaultsKey = defaultValue.join(",");
  const hintId = `${name}-${generatedId}-hint`;
  const limitReached = selected.length >= maxSelections;

  useEffect(() => setSelected([...defaultValue]), [defaultsKey]);
  useEffect(() => {
    const form = groupRef.current?.closest("form");
    if (!form) return;
    const reset = () => setSelected([...defaultValue]);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [defaultsKey]);

  return (
    <fieldset ref={groupRef} className="weekday-checkbox-group" aria-describedby={hintId} aria-required={required} data-max-selections={maxSelections}>
      <legend>{label}{required && <span className="required-mark" aria-hidden="true">*</span>}</legend>
      <div className="weekday-picker">
        {DEFAULT_WEEKDAYS.map((day, index) => {
          const checked = selected.includes(day.value);
          return (
            <label className="weekday-option" key={day.value}>
              <input
                id={`${name}-${generatedId}-${index}`}
                type="checkbox"
                name={name}
                value={day.value}
                checked={checked}
                disabled={disabled || (!checked && limitReached)}
                onChange={(event) => setSelected((current) => event.target.checked
                  ? [...current, day.value].slice(0, maxSelections)
                  : current.filter((value) => value !== day.value))}
              />
              <span>{day.label}</span>
            </label>
          );
        })}
      </div>
      <small id={hintId} className="form-field-hint" aria-live="polite">
        {limitReached ? `Limite de ${maxSelections} dias atingido.` : `Escolha de 1 a ${maxSelections} dias.`}
      </small>
    </fieldset>
  );
}

export function FormSection({ legend, children, className = "" }: { legend: string; children: ReactNode; className?: string }) {
  return <fieldset className={`form-section ${className}`}><legend>{legend}</legend>{children}</fieldset>;
}
