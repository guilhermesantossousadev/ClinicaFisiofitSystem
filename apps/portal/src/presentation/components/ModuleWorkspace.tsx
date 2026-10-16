import { createContext, useCallback, useContext, useId, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Icon, useDialogFocus } from "@fisiofit/design-system/react";
import type { View } from "../../domain/portal";

export type PatientContext = { id: string; name: string };
type Journey = { source: View; target: View; patient?: PatientContext; section?: string; recordId?: string };
type Workspace = {
  filters: Map<string, unknown>;
  journey: Journey | null;
  allowed: View[];
  open: (target: View, patient?: PatientContext, section?: string, recordId?: string) => void;
  back: () => void;
};
const WorkspaceContext = createContext<Workspace | null>(null);

// Only ephemeral filter state. Never place clinical data, identifiers or search text in browser storage.
export function ModuleWorkspace({ view, allowed, onNavigate, children }: { view: View; allowed: View[]; onNavigate: (view: View) => void; children: ReactNode }) {
  const filters = useRef(new Map<string, unknown>()).current;
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const journey = journeys.at(-1);
  const open: Workspace["open"] = (target, patient, section, recordId) => {
    if (!allowed.includes(target)) return;
    setJourneys(current => [...(current.at(-1)?.target === view ? current : []), { source: view, target, patient, section, recordId }]);
    onNavigate(target);
  };
  const back = () => { if (journey && allowed.includes(journey.source)) onNavigate(journey.source); setJourneys(current => current.slice(0,-1)); };
  return <WorkspaceContext.Provider value={{ filters, journey: journey?.target === view ? journey : null, allowed, open, back }}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() { return useContext(WorkspaceContext); }

export function useModuleState<T,>(key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const cache = useWorkspace()?.filters;
  const [state, setState] = useState<T>(() => cache?.has(key) ? cache.get(key) as T : typeof initial === "function" ? (initial as () => T)() : initial);
  const update = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    setState(previous => { const value = typeof next === "function" ? (next as (current: T) => T)(previous) : next; cache?.set(key, value); return value; });
  }, [cache, key]);
  return [state, update];
}

export function JourneyTrail() {
  const workspace = useWorkspace();
  if (!workspace?.journey) return null;
  const { source, target, patient } = workspace.journey;
  return <nav className="journey-trail" aria-label="Contexto da jornada"><button type="button" className="btn secondary" onClick={workspace.back}><span className="back-arrow"><Icon name="arrow" /></span> Voltar a {source}</button><span>{source} <span aria-hidden="true">/</span> {target}{patient && <strong>{patient.name}</strong>}</span><small>Filtros da origem preservados nesta sessão</small></nav>;
}

export function RelatedActions({ patient, exclude }: { patient: PatientContext; exclude?: View }) {
  const workspace = useWorkspace();
  if (!workspace) return null;
  return <div className="related-actions" aria-label={`Registros relacionados de ${patient.name}`}>{([['Pacientes', 'Ficha do paciente'], ['Matrículas', 'Matrículas e cobranças'], ['Prontuários', 'Prontuário'], ['Financeiro', 'Financeiro']] as const).filter(([view]) => view !== exclude && workspace.allowed.includes(view)).map(([view, label]) => <button type="button" className="btn secondary" key={view} onClick={() => workspace.open(view, patient)}>{label}<span aria-hidden="true"> →</span></button>)}</div>;
}

export function DetailPanel({ title, eyebrow, onClose, children, wide = false }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const id = useId();
  const ref = useDialogFocus(true, onClose);
  return <div className="module-detail-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section ref={ref} className={`module-detail${wide ? ' module-detail-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}><header className="module-detail-head"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 id={id}>{title}</h2></div><button type="button" className="dialog-close" aria-label="Fechar detalhes" onClick={onClose}>×</button></header><div className="module-detail-body">{children}</div></section></div>;
}

export function Facts({ items }: { items: Array<[string, ReactNode]> }) {
  return <dl className="module-facts">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "Não informado"}</dd></div>)}</dl>;
}

export function SectionIntro({ title, children }: { title: string; children: ReactNode }) {
  return <div className="section-intro"><strong>{title}</strong><p>{children}</p></div>;
}
