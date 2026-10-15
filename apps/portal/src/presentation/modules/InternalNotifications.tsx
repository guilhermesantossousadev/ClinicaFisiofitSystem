import { useState } from "react";
import { api } from "../../infrastructure/http/api";
import { messageOf, type Row, useResources } from "./OperationalShared";
const titles: Record<string, string> = { "agenda.cancelled": "Aula cancelada", "agenda.reopened": "Funcionamento autorizado", "agenda.substituted": "Substituição de profissional", "agenda.rescheduled": "Aula remarcada" };
export function InternalNotifications() {
 const path="/notifications?channel=internal";
 const {data,error,reload}=useResources([path]);
 const [unreadOnly,setUnreadOnly]=useState(false),[notice,setNotice]=useState("");
 const [kind,setKind]=useState("");
 const items: Row[]=data[path]??[];
 async function mark(item:Row) {try {await api(`/notifications/${item.id}/read`,{method:"PATCH",body:JSON.stringify({read:!item.read_at})});await reload();} catch(e){setNotice(messageOf(e));}}
 return <details className="internal-notifications"><summary>Notificações ({items.filter((i)=>!i.read_at).length})</summary><section className="card"><h2>Notificações internas</h2><label><input type="checkbox" checked={unreadOnly} onChange={(e)=>setUnreadOnly(e.target.checked)} /> Somente não lidas</label><label>Tipo<select value={kind} onChange={(e)=>setKind(e.target.value)}><option value="">Todos</option>{Object.entries(titles).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>{(notice||error)&&<p role="status">{notice||error}</p>}{items.filter((i)=>(!unreadOnly||!i.read_at)&&(!kind||i.template_key===kind)).map((i)=><article key={i.id}><strong>{titles[i.template_key]??"Alteração na agenda"}</strong><p>{i.payload?.start_at?new Date(i.payload.start_at).toLocaleString("pt-BR"):""}</p><button type="button" onClick={()=>void mark(i)}>{i.read_at?"Marcar como não lida":"Marcar como lida"}</button></article>)}{!items.length&&<p>Nenhuma notificação neste escopo.</p>}</section></details>;
}
