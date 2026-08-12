import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";

type BaseProps = {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
  required?: boolean;
};

function useFieldId(id: string | undefined, label: string) {
  const generated = useId();
  return id ?? `${label.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-")}-${generated.replaceAll(":", "")}`;
}

function FieldLabel({ id, label, required }: { id: string; label: string; required?: boolean }) {
  return (
    <label className="form-field-label" htmlFor={id}>
      <span>{label}{required && <span className="required-mark" aria-hidden="true">*</span>}</span>
    </label>
  );
}

function FieldMessage({ id, hint, error }: Pick<BaseProps, "hint" | "error"> & { id: string }) {
  if (!hint && !error) return null;
  return <small id={id} className={error ? "form-field-error" : "form-field-hint"}>{error ?? hint}</small>;
}

export function FormField({ label, hint, error, id, required, children }: BaseProps & { children: ReactNode }) {
  const controlId = useFieldId(id, label);
  const messageId = `${controlId}-message`;
  return (
    <div className="form-field">
      <FieldLabel id={controlId} label={label} required={required} />
      {children}
      <FieldMessage id={messageId} hint={hint} error={error} />
    </div>
  );
}

export function TextField({ label, hint, error, id, required, ...props }: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  const controlId = useFieldId(id, label);
  return (
    <FormField label={label} hint={hint} error={error} id={controlId} required={required}>
      <input {...props} id={controlId} required={required} aria-invalid={error ? "true" : undefined} />
    </FormField>
  );
}

export function TextareaField({ label, hint, error, id, required, ...props }: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const controlId = useFieldId(id, label);
  return (
    <FormField label={label} hint={hint} error={error} id={controlId} required={required}>
      <textarea {...props} id={controlId} required={required} aria-invalid={error ? "true" : undefined} />
    </FormField>
  );
}

export function SelectField({ label, hint, error, id, required, children, ...props }: BaseProps & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const controlId = useFieldId(id, label);
  return (
    <FormField label={label} hint={hint} error={error} id={controlId} required={required}>
      <select {...props} id={controlId} required={required} aria-invalid={error ? "true" : undefined}>{children}</select>
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

export function FormSection({ legend, children, className = "" }: { legend: string; children: ReactNode; className?: string }) {
  return <fieldset className={`form-section ${className}`}><legend>{legend}</legend>{children}</fieldset>;
}
