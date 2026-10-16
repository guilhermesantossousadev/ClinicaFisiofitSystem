import { Icon, Notice, EmptyState } from "@fisiofit/design-system/react";
import { useRef, useState } from "react";
import { api } from "../../infrastructure/http/api";
import { CheckboxField, SelectField } from "../components/FormPrimitives";
import { messageOf, type Row, useResources } from "./OperationalShared";
import { ModuleState } from "./OperationalShared";
import { useModuleState, useWorkspace } from "../components/ModuleWorkspace";
const titles: Record<string, string> = { "agenda.cancelled": "Aula cancelada", "agenda.reopened": "Funcionamento autorizado", "agenda.substituted": "Substituição de profissional", "agenda.rescheduled": "Aula remarcada" };
export function InternalNotifications() {
 const path="/notifications?channel=internal";
 const {data,loading,error,reload}=useResources([path]);
 const workspace=useWorkspace();
 const [unreadOnly,setUnreadOnly]=useModuleState('notifications.unread',false),[notice,setNotice]=useState("");
 const [kind,setKind]=useModuleState('notifications.kind',""),[busy,setBusy]=useState("");
 const pending=useRef(false),details=useRef<HTMLDetailsElement>(null);
 const items: Row[]=data[path]??[];
 const filtered=items.filter(i=>(!unreadOnly||!i.read_at)&&(!kind||i.template_key===kind));
 async function mark(item:Row) {if(pending.current)return;pending.current=true;setBusy(item.id);try {await api(`/notifications/${item.id}/read`,{method:"PATCH",body:JSON.stringify({read:!item.read_at})});await reload();} catch(e){setNotice(messageOf(e));}finally{setBusy("");pending.current=false;}}
 return <details ref={details} className="internal-notifications" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();details.current?.removeAttribute('open');details.current?.querySelector('summary')?.focus();}}}><summary aria-label={`Notificações: ${items.filter(i=>!i.read_at).length} não lidas`}><Icon name="bell"/><span className="notification-count">{items.filter(i=>!i.read_at).length}</span></summary><section className="card" aria-label="Central de notificações"><div className="notification-head"><h2>Notificações</h2><button type="button" aria-label="Fechar notificações" onClick={()=>{details.current?.removeAttribute('open');details.current?.querySelector('summary')?.focus();}}><Icon name="close"/></button></div><div className="notification-filter-grid"><CheckboxField label="Somente não lidas" checked={unreadOnly} onChange={e=>setUnreadOnly(e.target.checked)}/><SelectField label="Tipo de notificação" value={kind} onChange={e=>setKind(e.target.value)}><option value="">Todos os tipos</option>{Object.entries(titles).map(([id,label])=><option key={id} value={id}>{label}</option>)}</SelectField></div>{(notice||error)&&<Notice message={notice||error} tone="error" onDismiss={()=>setNotice("")}/>}<ModuleState loading={loading} error={error} retry={reload} /><div aria-live="polite">{filtered.map(i=><article key={i.id} className={i.read_at ? "notification-read" : "notification-unread"}><span className="status neutral">{i.read_at ? "Lida" : "Não lida"}</span><strong>{titles[i.template_key]??"Alteração na agenda"}</strong><p>{i.payload?.start_at?new Date(i.payload.start_at).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"}):"Data não informada"}</p>{i.payload?.occurrence_id && workspace?.allowed.includes("Agenda") && <button type="button" className="btn primary" onClick={()=>{details.current?.removeAttribute("open");workspace.open("Agenda",undefined,i.payload.start_at?.slice(0,10),i.payload.occurrence_id);}}>Abrir aula relacionada</button>}<button className="btn secondary" type="button" disabled={Boolean(busy)} aria-busy={busy===i.id} onClick={()=>void mark(i)}>{busy===i.id?"Atualizando…":i.read_at?"Marcar como não lida":"Marcar como lida"}</button></article>)}{!loading&&!error&&!filtered.length&&<EmptyState title="Nenhuma notificação" description={items.length?"Nenhuma corresponde aos filtros selecionados.":"As alterações da agenda aparecerão aqui."}/>}</div></section></details>;
}
