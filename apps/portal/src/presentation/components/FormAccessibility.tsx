import { useEffect, useRef, useState } from "react";

type FormError = { id?: string; message: string };

const digits = (value: string) => value.replace(/\D/g, "");

function messageFor(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  const label = field.labels?.[0]?.textContent?.replace(/\s*\*\s*$/, "").trim() || "Este campo";
  const validity = field.validity;
  if (validity.valueMissing) return `${label} precisa ser preenchido.`;
  if (validity.typeMismatch && field.type === "email") return `Digite um e-mail válido, como nome@exemplo.com.`;
  if (validity.tooShort && !(field instanceof HTMLSelectElement)) return `${label} precisa ter pelo menos ${field.minLength} caracteres.`;
  if (validity.tooLong && !(field instanceof HTMLSelectElement)) return `${label} pode ter no máximo ${field.maxLength} caracteres.`;
  if (validity.rangeUnderflow && field instanceof HTMLInputElement) return `${label} deve ser no mínimo ${field.min}.`;
  if (validity.rangeOverflow && field instanceof HTMLInputElement) return `${label} deve ser no máximo ${field.max}.`;
  if (validity.stepMismatch) return `${label} não está em um intervalo permitido.`;
  if (validity.badInput) return `Digite um valor válido em ${label.toLocaleLowerCase("pt-BR")}.`;
  return field.validationMessage || `Revise ${label.toLocaleLowerCase("pt-BR")}.`;
}

function setInlineError(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, message = "") {
  const id = `${field.id}-error`;
  let error = document.getElementById(id);
  field.setAttribute("aria-invalid", message ? "true" : "false");
  const describedBy = new Set((field.getAttribute("aria-describedby") || "").split(" ").filter(Boolean));
  if (message) {
    describedBy.add(id);
    if (!error) {
      error = document.createElement("span");
      error.id = id;
      error.className = "field-error";
      error.setAttribute("role", "alert");
      field.insertAdjacentElement("afterend", error);
    }
    error.textContent = message;
  } else {
    describedBy.delete(id);
    error?.remove();
  }
  if (describedBy.size) field.setAttribute("aria-describedby", [...describedBy].join(" "));
  else field.removeAttribute("aria-describedby");
}

function configureField(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, index: number) {
  if (!field.id) field.id = `${field.form?.id || "form"}-${field.name || "campo"}-${index}`;
  field.labels?.forEach((label) => {
    if (!label.htmlFor) label.htmlFor = field.id;
  });
  if (field.required) field.setAttribute("aria-required", "true");
  const label = field.labels?.[0];
  if (label && field.required && !label.querySelector(".required-mark")) {
    const mark = document.createElement("span");
    mark.className = "required-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = " *";
    label.insertBefore(mark, label.querySelector("input, select, textarea"));
  }
  const name = field.name;
  if (field instanceof HTMLInputElement) {
    if (name === "email") field.autocomplete = "email";
    if (name === "phone") { field.autocomplete = "tel"; field.inputMode = "tel"; field.placeholder ||= "(11) 99999-9999"; }
    if (name === "cpf") { field.inputMode = "numeric"; field.placeholder ||= "000.000.000-00"; field.maxLength = 14; }
    if (name === "zip") { field.autocomplete = "postal-code"; field.inputMode = "numeric"; field.placeholder ||= "00000-000"; field.maxLength = 9; }
    if (name === "state") { field.autocomplete = "address-level1"; field.autocapitalize = "characters"; }
    if (name === "street") field.autocomplete = "address-line1";
    if (name === "number") field.autocomplete = "address-line2";
    if (name === "city") field.autocomplete = "address-level2";
    if (name === "name") field.autocomplete ||= "name";
  }
}

function customMessage(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  if (field.dataset.validationMessage && !field.validity.valid) return field.dataset.validationMessage;
  const value = field.value.trim();
  if (!value) return "";
  if (field.name === "cpf" && digits(value).length !== 11) return "Digite os 11 números do CPF.";
  if (field.name === "phone" && ![10, 11].includes(digits(value).length)) return "Digite um telefone com DDD, usando 10 ou 11 números.";
  if (field.name === "zip" && digits(value).length !== 8) return "Digite os 8 números do CEP.";
  if (field.name === "state" && !/^[A-Za-z]{2}$/.test(value)) return "Digite a sigla do estado com 2 letras, como SP.";
  return "";
}

function validateForm(form: HTMLFormElement) {
  const fields = [...form.elements].filter((item): item is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
    item instanceof HTMLInputElement || item instanceof HTMLSelectElement || item instanceof HTMLTextAreaElement,
  );
  const errors: FormError[] = [];
  fields.forEach((field) => {
    if (field.disabled || field.type === "hidden" || field.type === "submit" || field.type === "button") return;
    const custom = customMessage(field);
    field.setCustomValidity(custom);
    const message = field.checkValidity() ? "" : messageFor(field);
    setInlineError(field, message);
    if (message) errors.push({ id: field.id, message });
  });
  for (const [startName, endName] of [["starts_at", "ends_at"], ["starts_on", "ends_on"]]) {
    const start = form.elements.namedItem(startName) as HTMLInputElement | null;
    const end = form.elements.namedItem(endName) as HTMLInputElement | null;
    if (start?.value && end?.value && end.value < start.value) {
      const message = "A data final não pode ser anterior à data inicial.";
      setInlineError(end, message);
      errors.push({ id: end.id, message });
    }
  }
  for (const groupName of ["weekdays", "unitIds"]) {
    const group = [...form.querySelectorAll<HTMLInputElement>(`input[name="${groupName}"]`)];
    const checkedCount = group.filter((item) => item.checked).length;
    const maxSelections = Number(group[0]?.closest<HTMLElement>("[data-max-selections]")?.dataset.maxSelections ?? 0);
    if (group.length && !checkedCount) {
      const message = groupName === "weekdays" ? "Selecione pelo menos um dia da semana." : "Selecione pelo menos uma unidade.";
      setInlineError(group[0], message);
      errors.push({ id: group[0].id, message });
    } else if (maxSelections && checkedCount > maxSelections) {
      const message = `Selecione no máximo ${maxSelections} dias da semana.`;
      setInlineError(group[0], message);
      errors.push({ id: group[0].id, message });
    }
  }
  return errors.filter((error, index, all) => all.findIndex((item) => item.id === error.id) === index);
}

export default function FormAccessibility() {
  const [errors, setErrors] = useState<FormError[]>([]);
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let formCount = 0;
    const enhance = () => document.querySelectorAll<HTMLFormElement>("form").forEach((form) => {
      if (!form.id) form.id = `fisiofit-form-${++formCount}`;
      form.noValidate = true;
      const heading = form.querySelector<HTMLElement>("h1, h2, h3");
      if (heading) {
        if (!heading.id) heading.id = `${form.id}-title`;
        form.setAttribute("aria-labelledby", heading.id);
      }
      [...form.elements].forEach((item, index) => {
        if (item instanceof HTMLInputElement || item instanceof HTMLSelectElement || item instanceof HTMLTextAreaElement) configureField(item, index);
      });
    });
    const enhanceStatuses = () => {
      document.querySelectorAll<HTMLElement>(".toast").forEach((toast) => {
        const isError = toast.textContent?.trim().toLocaleLowerCase("pt-BR").startsWith("✓erro:") ?? false;
        toast.classList.toggle("toast-error", isError);
        const icon = toast.querySelector("span");
        if (isError && icon) icon.textContent = "!";
        toast.setAttribute("role", isError ? "alert" : "status");
        toast.setAttribute("aria-live", isError ? "assertive" : "polite");
        toast.setAttribute("aria-atomic", "true");
      });
      document.querySelectorAll<HTMLElement>(".login-error").forEach((message) => {
        message.setAttribute("role", "alert");
        message.setAttribute("aria-live", "assertive");
      });
    };
    enhance();
    enhanceStatuses();
    const observer = new MutationObserver(() => { enhance(); enhanceStatuses(); });
    observer.observe(document.getElementById("root")!, { childList: true, subtree: true });
    const blur = (event: FocusEvent) => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) return;
      field.setCustomValidity(customMessage(field));
      setInlineError(field, field.checkValidity() ? "" : messageFor(field));
    };
    const input = (event: Event) => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) || field.getAttribute("aria-invalid") !== "true") return;
      field.setCustomValidity(customMessage(field));
      if (field.checkValidity()) setInlineError(field);
    };
    const submit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const nextErrors = validateForm(form);
      if (!nextErrors.length) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      trigger.current = document.activeElement as HTMLElement;
      setErrors(nextErrors);
    };
    document.addEventListener("focusout", blur, true);
    document.addEventListener("input", input, true);
    document.addEventListener("submit", submit, true);
    return () => { observer.disconnect(); document.removeEventListener("focusout", blur, true); document.removeEventListener("input", input, true); document.removeEventListener("submit", submit, true); };
  }, []);

  useEffect(() => { if (errors.length) closeButton.current?.focus(); }, [errors]);
  function close() { setErrors([]); requestAnimationFrame(() => trigger.current?.focus()); }
  function keyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") close();
    if (event.key !== "Tab" || !dialog.current) return;
    const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])')];
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  if (!errors.length) return null;
  return (
    <div className="validation-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div className="validation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="validation-title" aria-describedby="validation-description" ref={dialog} onKeyDown={keyDown}>
        <div className="validation-icon" aria-hidden="true">!</div>
        <div>
          <h2 id="validation-title">{errors.some((error) => error.id) ? "Vamos revisar alguns campos" : "Não foi possível concluir"}</h2>
          <p id="validation-description">{errors.some((error) => error.id) ? "Corrija os itens abaixo para continuar. Seus dados já preenchidos serão mantidos." : "O sistema encontrou um problema ao salvar. Seus dados preenchidos foram mantidos."}</p>
        </div>
        <ul>{errors.map((error, index) => <li key={error.id || index}>{error.id ? <button type="button" onClick={() => { close(); requestAnimationFrame(() => document.getElementById(error.id!)?.focus()); }}>{error.message}</button> : <p className="validation-api-message">{error.message}</p>}</li>)}</ul>
        <button className="btn primary validation-close" type="button" ref={closeButton} onClick={() => { const fieldId = errors[0]?.id; close(); if (fieldId) requestAnimationFrame(() => document.getElementById(fieldId)?.focus()); }}>{errors.some((error) => error.id) ? "Revisar primeiro campo" : "Entendi"}</button>
      </div>
    </div>
  );
}
