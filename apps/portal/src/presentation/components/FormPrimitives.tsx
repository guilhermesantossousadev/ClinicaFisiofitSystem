import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";

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

export function FormSection({ legend, children, className = "" }: { legend: string; children: ReactNode; className?: string }) {
  return <fieldset className={`form-section ${className}`}><legend>{legend}</legend>{children}</fieldset>;
}
