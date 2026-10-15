import { confirmAction } from '../components/Decisions';
import { DataTable, Skeleton, useDialogFocus } from "@fisiofit/design-system/react";
export { useDialogFocus } from "@fisiofit/design-system/react";
import { FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { api } from "../../infrastructure/http/api";
import { getPortalSessionGeneration, operationalResourceCache } from "../../infrastructure/session/portalSessionState";
import { CheckboxField, FormField, FormSection, SelectField, TextareaField, TextField } from "../components/FormPrimitives";

export type Row = Record<string, any>;
export type Unit = { id: string; name: string };

const WEEKDAY_SHORT_LABELS: Record<number, string> = {
  0: "Dom",
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
};

export function weekdaysLabel(weekdays: unknown) {
  if (!Array.isArray(weekdays)) return "Dias não definidos";
  const labels = weekdays.map(Number).map((day) => WEEKDAY_SHORT_LABELS[day]).filter(Boolean);
  return labels.length ? labels.join("/") : "Dias não definidos";
}

export function groupSlotLabel(slot: Row, professionalName?: string) {
  const schedule = `${weekdaysLabel(slot.weekdays)} · ${String(slot.starts_at ?? "").slice(0, 5)}`;
  return `${slot.name ?? "Turma"} · ${schedule}${professionalName ? ` · ${professionalName}` : ""}`;
}

export const PLAN_PERIODS = {
  monthly: { label: "Mensal", months: 1, durationDays: 30 },
  quarterly: { label: "Trimestral", months: 3, durationDays: 90 },
  semiannual: { label: "Semestral", months: 6, durationDays: 180 },
} as const;

export type PlanPeriod = keyof typeof PLAN_PERIODS;
export type WeeklyFrequency = 1 | 2 | 3;

export function messageOf(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";
  return `Erro: ${message}`;
}

export function value(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

export function cents(raw: string) {
  return Math.round(Number(raw.replace(",", ".")) * 100);
}

export function brl(amountCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amountCents / 100);
}

const STATUS_LABELS: Record<string, string> = {
  planned: "Planejada", in_progress: "Em andamento", PRESENT: "Presente", LATE: "Atrasado", ABSENT_JUSTIFIED: "Falta justificada", ABSENT_UNJUSTIFIED: "Falta", CANCELLED_IN_ADVANCE: "Cancelado antecipadamente", CANCELLED_LATE: "Cancelado tardiamente",
  active: "Ativo", inactive: "Inativo", blocked: "Bloqueado", invited: "Convite enviado",
  scheduled: "Agendado", confirmed: "Confirmado", attending: "Em atendimento", completed: "Concluído",
  missed: "Falta", cancelled: "Cancelado", present: "Presente", absent: "Faltou",
  pending: "Pendente", partial: "Parcial", paid: "Pago", overdue: "Vencido",
  approved: "Aprovado", rejected: "Rejeitado", processing: "Em processamento", imported: "Importado",
  draft: "Rascunho", signed: "Assinado", rectification: "Retificação", closed: "Fechado",
  income: "Entrada", expense: "Saída", appointment: "Atendimento", payment: "Recebimento",
  manual: "Manual", succeeded: "Concluído", failed: "Falhou", rolled_back: "Revertido",
};

export function statusLabel(value: unknown) {
  const key = String(value ?? "").trim();
  return STATUS_LABELS[key] ?? (key.replaceAll("_", " ") || "—");
}

export function planTotalCents(plan: Row) {
  return Number(plan.price_cents ?? 0);
}

export function isoLocal(raw: string) {
  return new Date(raw).toISOString();
}

export function localDateTime(raw: string) {
  const date = new Date(raw);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function dateKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function localDateAtNoonIso(raw: string) {
  return new Date(`${raw}T12:00:00`).toISOString();
}

const pagedResources = new Set(["/enrollments", "/charges", "/payments", "/enrollment-price-terms", "/commissions", "/closings", "/fiscal-documents", "/audit"]);
const unitResources = new Set([...pagedResources, "/financial-entries", "/reports/annual", "/reports/monthly"]);
async function operationalResource(path: string, unit: string) {
  const url = new URL(path, "https://local.invalid");
  if (unit && unitResources.has(url.pathname) && !url.searchParams.has("unitId")) url.searchParams.set("unitId", unit);
  const response = await api<any>(url.pathname + url.search);
  if (!pagedResources.has(url.pathname) || url.searchParams.has("page") || !Array.isArray(response.data)) return response;
  const items = [...response.data];
  for (let page = 2; response.data?.length === 500;) {
    url.searchParams.set("page", String(page++));
    const next = await api<any[]>(url.pathname + url.search);
    items.push(...(next.data ?? []));
    if ((next.data?.length ?? 0) < 500) break;
  }
  return { ...response, data: items };
}

export function useResources(paths: string[]) {
  const key = paths.join("|");
  const selectedUnit = typeof window === "undefined" ? "" : window.localStorage.getItem("fisiofit:selected-unit") ?? "";
  const cacheKey = `${selectedUnit}:${key}`;
  const [data, setData] = useState<Record<string, any>>(() => operationalResourceCache.get(cacheKey) ?? {});
  const [loading, setLoading] = useState(() => !operationalResourceCache.has(cacheKey));
  const [error, setError] = useState("");
  const requestVersion = useRef(0);
  const dataScope = useRef(cacheKey);
  const reload = useCallback(async () => {
    const currentRequest = ++requestVersion.current;
    const sessionGeneration = getPortalSessionGeneration();
    setLoading(true);
    setError("");
    dataScope.current = cacheKey;
    setData(operationalResourceCache.get(cacheKey) ?? {});
    try {
      const responses = await Promise.allSettled(paths.map(async (path) => {
        const response = await operationalResource(path, selectedUnit);
        if (sessionGeneration === getPortalSessionGeneration() && currentRequest === requestVersion.current) {
          setData((current) => ({ ...current, [path]: response.data }));
        }
        return response;
      }));
      const nextData = Object.fromEntries(
        paths.flatMap((path, index) => {
          const response = responses[index];
          return response.status === "fulfilled" ? [[path, response.value.data]] : [];
        }),
      );
      if (sessionGeneration !== getPortalSessionGeneration() || currentRequest !== requestVersion.current) return;
      operationalResourceCache.set(cacheKey, nextData);
      setData(nextData);
      const failures = responses.filter((response): response is PromiseRejectedResult => response.status === "rejected");
      if (failures.length) setError(messageOf(failures[0].reason));
    } catch (loadError) {
      if (currentRequest === requestVersion.current) setError(messageOf(loadError));
    } finally {
      if (currentRequest === requestVersion.current) setLoading(false);
    }
  }, [cacheKey, key]);
  useEffect(() => {
    void reload();
    const onUnitChanged = () => void reload();
    window.addEventListener("fisiofit:unit-changed", onUnitChanged);
    return () => {
      requestVersion.current += 1;
      window.removeEventListener("fisiofit:unit-changed", onUnitChanged);
    };
  }, [reload]);
  return { data: dataScope.current === cacheKey ? data : (operationalResourceCache.get(cacheKey) ?? {}), loading: dataScope.current !== cacheKey || loading, error: dataScope.current === cacheKey ? error : "", reload };
}

export function Select({
  name,
  rows,
  label,
  required = true,
  defaultValue,
  id,
}: {
  name: string;
  rows: Row[];
  label: string;
  required?: boolean;
  defaultValue?: string;
  id?: string;
}) {
  const generatedId = useId();
  const fieldId = id ?? `${name}-${generatedId.replaceAll(":", "")}`;

  return (
    <SelectField id={fieldId} name={name} label={label} required={required} defaultValue={defaultValue ?? ""}>
        <option value="">Selecione</option>
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name ?? row.description}
          </option>
        ))}
    </SelectField>
  );
}

export function PlanSelect({ rows }: { rows: Row[] }) {
  const generatedId = useId();
  const fieldId = `plan-${generatedId.replaceAll(":", "")}`;
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const activePlans = rows.filter((row) => row.active !== false);
  const selectedPlan = activePlans.find((row) => row.id === selectedPlanId);

  return (
    <div className="input-group plan-select">
      <SelectField id={fieldId} name="plan_id" label="Plano" required value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}>
        <option value="">{activePlans.length ? "Selecione" : "Nenhum plano disponível"}</option>
        {activePlans.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name} · {brl(Number(row.price_cents ?? 0))}
          </option>
        ))}
      </SelectField>
      {!activePlans.length && <p className="form-field-error" role="status">Não há planos ativos para novas matrículas. Peça à gestão para ativar ou cadastrar o plano utilizado pela clínica.</p>}
      {selectedPlan && (
        <div className="plan-summary" role="status" aria-live="polite">
          <strong>{brl(Number(selectedPlan.price_cents ?? 0))}</strong>
          <span>
            {selectedPlan.sessions_included ? `${selectedPlan.sessions_included} sessões` : "Sessões não definidas"}
            {selectedPlan.duration_days ? ` · ${selectedPlan.duration_days} dias` : ""}
            {selectedPlan.active === false ? " · Inativo" : " · Ativo"}
          </span>
        </div>
      )}
    </div>
  );
}

export function PatientPicker({
  name = "patient_id",
  rows,
  label,
  required = true,
  defaultValue = "",
  defaultLabel = "",
  onSelect,
  onClear,
  id,
  allowedIds,
  unitId,
  crossUnit = false,
  remoteSearch = true,
}: {
  name?: string;
  rows: Row[];
  label: string;
  required?: boolean;
  defaultValue?: string;
  defaultLabel?: string;
  onSelect?: (patient: Row) => void;
  onClear?: () => void;
  id?: string;
  allowedIds?: string[];
  unitId?: string;
  crossUnit?: boolean;
  remoteSearch?: boolean;
}) {
  const generatedId = useId();
  const fieldId = id ?? `${name}-${generatedId.replaceAll(":", "")}`;
  const optionsId = `${fieldId}-options`;
  const [query, setQuery] = useState(defaultLabel);
  const [selectedId, setSelectedId] = useState(defaultValue);
  const [options, setOptions] = useState<Row[]>(rows);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  useEffect(() => setOptions(rows), [rows]);
  useEffect(() => setActiveIndex(-1), [options, query]);
  useEffect(() => {
    const search = query.trim();
    if (search.length < 2) return;
    if (!remoteSearch) {
      const term = search.toLocaleLowerCase("pt-BR");
      setOptions(rows.filter((row) => String(row.name ?? "").toLocaleLowerCase("pt-BR").includes(term) && (!allowedIds || allowedIds.includes(row.id))));
      return;
    }
    let active = true;
    setSearching(true); setSearchError(""); setOptions([]);
    const timer = window.setTimeout(() => {
      const unitFilter = unitId ? `&unitId=${encodeURIComponent(unitId)}` : "";
      void api<{ items: Row[] }>(`/patients?page=1&pageSize=100&search=${encodeURIComponent(search)}${unitFilter}`, { scopeUnit: !crossUnit })
        .then((response) => {
          if (!active) return;
          setSearching(false);
          const results = response.data?.items ?? [];
          if (!allowedIds) return setOptions(results);
          const allowedIdSet = new Set(allowedIds);
          setOptions(results.filter((row) => allowedIdSet.has(row.id)));
        })
        .catch(error => { if (active) { setSearching(false); setOptions([]); setSearchError(messageOf(error).replace(/^Erro:\s*/, "")); } });
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [allowedIds, query, rows, unitId, crossUnit, remoteSearch]);
  const choose = (patient: Row) => {
    setSelectedId(patient.id);
    setQuery(patient.name ?? "Paciente");
    setOpen(false);
    setActiveIndex(-1);
    onSelect?.(patient);
  };
  const selectable = query.trim().length >= 2 ? options.slice(0, 8) : [];
  const hasInvalidFreeText = query.trim().length > 0 && !selectedId;
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!selectable.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current + 1) % selectable.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current <= 0 ? selectable.length - 1 : current - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      choose(selectable[activeIndex]);
    }
  };
  return (
    <FormField className="input-group patient-picker" label={label} id={fieldId} required={required}>
      <input type="hidden" name={name} value={selectedId} />
      <input
        id={fieldId}
        type="text"
        value={query}
        required={required}
        pattern={hasInvalidFreeText ? "(?!)" : undefined}
        title={hasInvalidFreeText ? "Selecione um paciente da lista." : undefined}
        data-validation-message={hasInvalidFreeText ? "Selecione um paciente da lista." : undefined}
        aria-invalid={hasInvalidFreeText ? "true" : undefined}
        aria-expanded={open && selectable.length > 0}
        aria-controls={selectable.length ? optionsId : undefined}
        aria-busy={searching}
        aria-describedby={open && !selectable.length ? `${optionsId}-status` : undefined}
        aria-activedescendant={activeIndex >= 0 ? `${optionsId}-${selectable[activeIndex]?.id}` : undefined}
        aria-autocomplete="list"
        role="combobox"
        autoComplete="off"
        placeholder="Digite nome, telefone ou CPF"
        onFocus={() => setOpen(selectable.length > 0)}
        onKeyDown={handleKeyDown}
        onChange={(event) => {
          setQuery(event.target.value);
          if (selectedId) onClear?.();
          setSelectedId("");
          setOpen(event.target.value.trim().length >= 2);
        }}
      />
      {open && query.trim().length >= 2 && (
        <div className="patient-picker-options" id={optionsId} role={selectable.length ? "listbox" : undefined} aria-label={`${label}: resultados`}>
          {selectable.length ? selectable.map((patient, index) => (
            <div
              id={`${optionsId}-${patient.id}`}
              role="option"
              aria-selected={index === activeIndex}
              key={patient.id}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(patient)}
            >
              <strong>{patient.name}</strong>
              <small>{patient.phone ?? patient.cpf ?? ""}</small>
            </div>
          )) : <span id={`${optionsId}-status`} className="patient-picker-empty" role="status">{searching ? "Buscando pacientes…" : searchError || "Nenhum paciente encontrado."}</span>}
        </div>
      )}
    </FormField>
  );
}

export function DrawerForm({
  title,
  children,
  onSubmit,
  className = "",
  openInitially = false,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  className?: string;
  openInitially?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(openInitially);
  const [submitting, setSubmitting] = useState(false);
  const generatedId = useId();
  const dialogId = `drawer-${generatedId.replaceAll(":", "")}`;
  const titleId = `${dialogId}-title`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialogFocus(open, () => close(), !submitting);
  const formRef = useRef<HTMLFormElement>(null);
  const dirtyRef = useRef(false);
  const submittingRef = useRef(false);
  const close = async (force = false) => {
    if (submittingRef.current) return;
    if (!force && dirtyRef.current && !await confirmAction("Descartar as alterações deste formulário? Os dados preenchidos não serão salvos.")) return;
    dirtyRef.current = false;
    setOpen(false);
    onClose?.();
    requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    if (submittingRef.current) {
      event.preventDefault();
      return;
    }
    submittingRef.current = true;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    setSubmitting(true);
    if (submitter instanceof HTMLButtonElement) {
      submitter.disabled = true;
      submitter.classList.add("is-loading");
      submitter.setAttribute("aria-busy", "true");
      submitter.dataset.loadingLabel = "Processando";
    }
    try {
      await onSubmit(event);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      if (submitter instanceof HTMLButtonElement) {
        submitter.disabled = false;
        submitter.classList.remove("is-loading");
        submitter.removeAttribute("aria-busy");
        delete submitter.dataset.loadingLabel;
      }
    }
  };
  return (
    <>
      <button
        ref={triggerRef}
        className={`card drawer-create-trigger ${className}`}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={() => {
          dirtyRef.current = false;
          setOpen(true);
        }}
      >
        <span aria-hidden="true">＋</span>
        <span><strong>{title}</strong><small>Abrir formulário de cadastro</small></span>
        <span aria-hidden="true">→</span>
      </button>
      {open && (
        <div className="modal-backdrop creation-drawer-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}>
          <section
            ref={dialogRef}
            id={dialogId}
            className={`modal creation-drawer ${title.includes("turma") ? "agenda-group-drawer" : title.includes("agendamento") ? "agenda-appointment-drawer" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="modal-head">
              <h2 id={titleId}>{title}</h2>
              <button ref={closeRef} type="button" onClick={() => close()} disabled={submitting} aria-label={`Fechar ${title}`}>×</button>
            </div>
            <form ref={formRef} className="modal-form creation-drawer-form" onSubmit={(event) => void submit(event)} onInput={() => { dirtyRef.current = true; }} onReset={() => { dirtyRef.current = false; }} aria-busy={submitting}>
              {children}
            </form>
          </section>
        </div>
      )}
    </>
  );
}

export function ModuleState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry?: () => void | Promise<void>;
}) {
  if (loading) return <Skeleton />;
  if (error)
    return (
      <div className="system-message error-message" role="alert">
        <span className="message-icon" aria-hidden="true">!</span>
        <div>
          <strong>Não foi possível carregar os dados</strong>
          <p>{error}</p>
        </div>
        {retry && <button className="btn secondary" type="button" onClick={() => void retry()}>Tentar novamente</button>}
      </div>
    );
  return null;
}

export type AgendaEnrollmentContext = { unitId: string; groupSlotId: string; startsAt: string; unitName?: string; groupName?: string };

export function MetricLite({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="metric-card">
      <div className="metric-copy">
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

export type EditField = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "email" | "tel" | "datetime-local" | "select" | "textarea" | "checkbox-group";
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  step?: string;
  value?: (row: Row) => unknown;
  options?: Row[];
};

export function EditableOperationalTable({
  title,
  resource,
  rows,
  fields,
  editFields,
  buildBody,
  saveRow,
  onChanged,
  onNotice,
  onOpen,
  actions,
  allowDelete = false,
  showToggle = true,
  canEdit = true,
  emptyMessage = "Nenhum registro cadastrado.",
  total,
  page,
  pageSize,
  onPageChange,
}: {
  title: string;
  resource: string;
  rows: Row[];
  fields: string[];
  editFields: EditField[];
  buildBody: (form: FormData) => Row;
  saveRow?: (row: Row, form: FormData) => void | Promise<void>;
  onChanged: () => void | Promise<void>;
  onNotice: (message: string) => void;
  onOpen?: (row: Row) => void | Promise<void>;
  actions?: (row: Row) => ReactNode;
  allowDelete?: boolean;
  showToggle?: boolean;
  canEdit?: boolean;
  emptyMessage?: string;
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
}) {
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const editDialogRef = useDialogFocus(Boolean(editing), () => closeEditing(), !saving);
  const editTriggerRef = useRef<HTMLButtonElement | null>(null);
  const editDirtyRef = useRef(false);
  const savingRef = useRef(false);
  const rowPending = useRef(false);
  const [rowBusy, setRowBusy] = useState("");

  async function closeEditing(force = false) {
    if (savingRef.current) return;
    if (!force && editDirtyRef.current && !await confirmAction("Descartar as alterações desta edição? Os dados modificados não serão salvos.")) return;
    editDirtyRef.current = false;
    setEditing(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || savingRef.current) return;
    setSaveError("");
    savingRef.current = true;
    setSaving(true);
    try {
      const form = new FormData(event.currentTarget);
      if (saveRow) {
        await saveRow(editing, form);
      } else {
        await api(`/${resource}/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(buildBody(form)),
        });
      }
      await onChanged();
      editDirtyRef.current = false;
      setEditing(null);
      onNotice(`${title.replace(/s$/, "")} atualizado com sucesso.`);
    } catch (error) {
      setSaveError(messageOf(error));
      onNotice(messageOf(error));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function toggle(row: Row) {
    if (rowPending.current) return;
    const activate = row.active === false;
    if (!activate && !await confirmAction(
      `Inativar ${row.name}? O histórico será preservado e o cadastro poderá ser reativado.`,
    )) return;
    if (rowPending.current) return;
    rowPending.current = true; setRowBusy(row.id);
    try {
      await api(`/${resource}/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: activate }),
      });
      await onChanged();
      onNotice(activate ? "Cadastro reativado." : "Cadastro inativado.");
    } catch (error) {
      onNotice(messageOf(error));
    } finally { rowPending.current = false; setRowBusy(""); }
  }

  async function remove(row: Row) {
    if (rowPending.current) return;
    if (!await confirmAction(`Excluir ${row.name}? O cadastro sairá das listagens. O histórico clínico e financeiro será preservado para fins legais.`)) return;
    if (rowPending.current) return;
    rowPending.current = true; setRowBusy(row.id);
    try {
      await api(`/${resource}/${row.id}`, { method: "DELETE" });
      await onChanged();
      onNotice("Cadastro excluído com segurança.");
    } catch (error) {
      onNotice(messageOf(error));
    } finally { rowPending.current = false; setRowBusy(""); }
  }

  return (
    <>
      <DataTable title={title} rows={rows} count={total} emptyMessage={emptyMessage}
        columns={fields.map((field, index) => ({ key: field, label: fieldLabel(field),
          sortValue: (row: Row) => typeof row[field] === "number" ? row[field] : field.endsWith("_at") || field.endsWith("_on") || field.endsWith("_date") ? String(row[field] ?? "") : String(render(row[field], field)),
          render: (row: Row) => field === "active" ? <span className={`status ${row.active === false ? "neutral" : "success"}`}>{render(row[field], field)}</span>
            : index === 0 ? <strong>{render(row[field], field)}</strong> : render(row[field], field) }))}
        actions={(row) => <>
          {onOpen && <button type="button" onClick={() => void onOpen(row)}>Detalhes</button>}
          {actions?.(row)}
          {canEdit && <button type="button" onClick={(event) => { editTriggerRef.current = event.currentTarget; editDirtyRef.current = false; setSaveError(""); setEditing(row); }}>Editar</button>}
          {canEdit && showToggle && <button type="button" disabled={Boolean(rowBusy)} aria-busy={rowBusy === row.id} className={row.active === false ? "action-activate" : "action-inactivate"} onClick={() => void toggle(row)}>{row.active === false ? "Reativar" : "Inativar"}</button>}
          {canEdit && allowDelete && <button type="button" disabled={Boolean(rowBusy)} aria-busy={rowBusy === row.id} className="action-delete" onClick={() => void remove(row)}>Excluir</button>}
        </>}
        footer={page && pageSize && total !== undefined && total > pageSize ? <nav className="table-pagination" aria-label={`Paginação de ${title}`}>
          <button className="btn secondary" type="button" disabled={page === 1} onClick={() => onPageChange?.(page - 1)}>Anterior</button><span>Página {page} de {Math.ceil(total / pageSize)} · Ordenação nesta página</span><button className="btn secondary" type="button" disabled={page >= Math.ceil(total / pageSize)} onClick={() => onPageChange?.(page + 1)}>Próxima</button>
        </nav> : undefined} />
      {editing && (
        <div className="edit-dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeEditing();
        }}>
          <section ref={editDialogRef} className="edit-dialog" role="dialog" aria-modal="true" aria-labelledby={`edit-${resource}-title`}>
            <div className="edit-dialog-header">
              <div>
                <p className="eyebrow">EDIÇÃO DE CADASTRO</p>
                <h2 id={`edit-${resource}-title`}>Editar {editing.name}</h2>
              </div>
              <button type="button" className="dialog-close" aria-label="Fechar edição" onClick={() => closeEditing()} disabled={saving}>×</button>
            </div>
            <form className="modal-form" onSubmit={save} onInput={() => { editDirtyRef.current = true; }} aria-busy={saving}>
              {saveError && <p className="form-field-error" role="alert">{saveError}</p>}
              {editFields.map((field) => (
                field.type === "select" ? <SelectField key={field.name} name={field.name} label={field.label} required={field.required} defaultValue={String(field.value ? field.value(editing) ?? "" : editing[field.name] ?? "")}>
                    <option value="">Selecione</option>
                    {(field.options ?? []).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                  </SelectField> : field.type === "checkbox-group" ? <FormSection key={field.name} legend={field.label}>
                    <div className="weekday-checks">
                      {(field.options ?? []).map((option) => {
                        const selected = field.value ? field.value(editing) : editing[field.name];
                        return <CheckboxField key={option.id} name={field.name} value={option.id} label={option.name} defaultChecked={Array.isArray(selected) && selected.includes(option.id)} />;
                      })}
                    </div>
                  </FormSection> : field.type === "textarea" ? <TextareaField key={field.name} name={field.name} label={field.label} rows={4} defaultValue={String(field.value ? field.value(editing) ?? "" : editing[field.name] ?? "")} /> : <TextField
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    type={field.type ?? "text"}
                    required={field.required}
                    min={field.min}
                    max={field.max}
                    minLength={field.minLength}
                    maxLength={field.maxLength}
                    step={field.step}
                    defaultValue={String(field.value ? field.value(editing) ?? "" : editing[field.name] ?? "")}
                  />
              ))}
              <div className="edit-dialog-actions">
                <button type="button" className="btn secondary" onClick={() => closeEditing()} disabled={saving}>Cancelar</button>
                <button className="btn primary" disabled={saving}>{saving ? "Salvando…" : "Salvar alterações"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

export function OperationalTable({
  title,
  rows,
  fields,
  actions,
  emptyMessage = "Nenhum registro cadastrado.",
}: {
  title: string;
  rows: Row[];
  fields: string[];
  actions?: (row: Row) => ReactNode;
  emptyMessage?: string;
}) {
  return <DataTable title={title} rows={rows} emptyMessage={emptyMessage} actions={actions}
    columns={fields.map((field,index) => ({key:field,label:fieldLabel(field),sortValue:(row: Row) => typeof row[field] === "number" ? row[field] : field.endsWith("_at") || field.endsWith("_on") || field.endsWith("_date") ? String(row[field] ?? "") : String(render(row[field],field)),render:(row: Row) => index===0?<strong>{render(row[field],field)}</strong>:render(row[field],field)}))} />;
}
export function fieldLabel(field: string) {
  const labels: Record<string, string> = {
    name: "Nome", phone: "Telefone", email: "E-mail", active: "Status",
    kind: "Tipo", sessions_included: "Sessões", duration_days: "Duração",
    price_cents: "Preço", status: "Status", starts_at: "Início", starts_on: "Início do período",
    ends_at: "Fim do período", ends_on: "Fim do período",
    due_day: "Vencimento", sessions_used: "Sessões usadas",
    total_plan_cents: "Valor total do plano",
    allocation: "Alocação de pacientes",
    description: "Descrição", amount_cents: "Valor", paid_cents: "Valor pago",
    due_at: "Vencimento", competence_date: "Competência", category: "Categoria",
    requester_name: "Solicitante", title: "Título", severity: "Severidade",
    discovered_at: "Identificado em", action: "Ação", entity_type: "Recurso",
    user_id: "Usuário", occurred_at: "Data", capacity: "Capacidade",
    duration_minutes: "Duração", council: "Conselho", specialty: "Especialidade", unit_names: "Unidades",
    weekdays: "Dias da semana", weekdays_label: "Dias da semana",
    plan_name: "Plano", group_name: "Turma",
  };
  return labels[field] ?? field.replaceAll("_", " ");
}
export function render(value: any, field: string) {
  if (value == null) return "—";
  if (field.includes("amount") || field.includes("paid_cents") || field === "price_cents" || field === "total_plan_cents")
    return brl(Number(value));
  if (field === "kind") return ({
    monthly: "Mensal", package: "Pacote", single: "Avulso", assessment: "Avaliação", evolution: "Evolução",
    access: "Acesso", correction: "Correção", sharing: "Compartilhamentos", opposition: "Oposição",
    portability: "Portabilidade", revocation: "Revogação", deletion: "Eliminação aplicável",
    income: "Entrada", expense: "Saída",
  } as Record<string, string>)[String(value)] ?? statusLabel(value);
  if (field === "status") return statusLabel(value);
  if (field === "severity") return ({ low: "Baixa", medium: "Média", high: "Alta", critical: "Crítica" } as Record<string, string>)[String(value)] ?? statusLabel(value);
  if (field === "action") return ({ INSERT: "Criação", UPDATE: "Alteração", DELETE: "Exclusão", create: "Criação", update: "Alteração", delete: "Exclusão" } as Record<string, string>)[String(value)] ?? statusLabel(value);
  if (field === "entity_type") return ({ patient: "Paciente", patients: "Paciente", appointment: "Agendamento", appointments: "Agendamento", enrollment: "Matrícula", enrollments: "Matrícula", clinical_record: "Prontuário", clinical_records: "Prontuário", user: "Usuário", profiles: "Usuário" } as Record<string, string>)[String(value)] ?? statusLabel(value);
  if (field === "active") return value ? "Ativo" : "Inativo";
  if (field === "weekdays" && Array.isArray(value)) {
    return value.map((day: number) => (["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const)[day] ?? day).join(" · ");
  }
  if ((field.endsWith("_at") || field.endsWith("_date") || field.endsWith("_on")) && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(`${value}T00:00:00`));
  }
  if ((field.endsWith("_at") || field.endsWith("_date") || field.endsWith("_on")) && !Number.isNaN(new Date(String(value)).valueOf())) {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(String(value)));
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
