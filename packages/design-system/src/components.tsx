import {useId, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode} from 'react';

export type IconName = 'dashboard'|'calendar'|'check'|'patients'|'plans'|'records'|'finance'|'reports'|'imports'|'users'|'settings'|'privacy'|'search'|'location'|'bell'|'close'|'arrow'|'plus'|'chevron'|'menu'|'info'|'warning';
const paths: Record<IconName, ReactNode> = {
 dashboard:<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
 calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></>,
 check:<path d="m5 12 4 4L19 6"/>, patients:<><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5"/></>,
 plans:<><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/></>,
 records:<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 15h8M12 11v8"/></>,
 finance:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></>,
 reports:<><path d="M4 3v18h17M9 16V9M14 16V5M19 16v-5"/></>, imports:<><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
 users:<><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
 settings:<><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/></>,
 privacy:<><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/></>,
 search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,location:<><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
 bell:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
 close:<path d="m6 6 12 12M6 18 18 6"/>,arrow:<path d="M4 12h16m-6-6 6 6-6 6"/>,plus:<path d="M12 4v16M4 12h16"/>,chevron:<path d="m9 5 7 7-7 7"/>,menu:<path d="M4 6h16M4 12h16M4 18h16"/>,
 info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,warning:<><path d="m12 3 10 18H2zM12 9v5M12 17h.01"/></>,
};
export function Icon({name,size=20,className=''}:{name:IconName;size?:number;className?:string}){return <svg className={`ff-icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;}

export function Button({variant='secondary',busy=false,children,disabled,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'danger'|'quiet';busy?:boolean}){return <button {...props} disabled={disabled||busy} aria-busy={busy||undefined} className={`btn ${variant} ${props.className??''}`}>{busy&&<span className="ff-spinner" aria-hidden="true"/>}{children}</button>;}

export function Notice({message,onDismiss,tone}: {message:string;onDismiss?:()=>void;tone?:'success'|'error'|'info'|'warning'}) {
 const resolved=tone??(/^Erro:/.test(message)?'error':'success');
 return <div className={`ff-notice ff-notice-${resolved}`} role={resolved==='error'?'alert':'status'} aria-live={resolved==='error'?'assertive':'polite'} aria-atomic="true"><Icon name={resolved==='success'?'check':resolved==='error'?'warning':'info'}/><div><strong>{({success:'Concluído',error:'Não foi possível concluir',info:'Informação',warning:'Atenção'} as const)[resolved]}</strong><p>{message.replace(/^Erro:\s*/,'')}</p></div>{onDismiss&&<button type="button" className="ff-notice-close" aria-label="Fechar mensagem" onClick={onDismiss}><Icon name="close" size={18}/></button>}</div>;
}
export function EmptyState({title,description,action}: {title:string;description?:string;action?:ReactNode}){return <div className="empty-state"><Icon name="search" size={28}/><strong>{title}</strong>{description&&<p>{description}</p>}{action}</div>;}

export function Tabs<T extends string>({items,value,onChange,label,id:providedId}: {items:ReadonlyArray<{value:T;label:string;count?:number}>;value:T;onChange:(v:T)=>void;label:string;id?:string}){
 const generated=useId().replaceAll(':','');const id=providedId??`tabs-${generated}`;
 return <div className="ff-tabs" role="tablist" aria-label={label}>{items.map((item,index)=><button key={item.value} type="button" role="tab" id={`${id}-${item.value}`} aria-selected={value===item.value} aria-controls={`${id}-panel-${item.value}`} tabIndex={value===item.value?0:-1} onClick={()=>onChange(item.value)} onKeyDown={e=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowRight'?1:-1)+items.length)%items.length;onChange(items[next].value);document.getElementById(`${id}-${items[next].value}`)?.focus();}}>{item.label}{item.count!==undefined&&<span className="ff-tab-count">{item.count}</span>}</button>)}</div>;
}

export type DataColumn<T>={key:string;label:string;render:(row:T)=>ReactNode;sortValue?:(row:T)=>string|number};
export function DataTable<T extends Record<string,unknown>>({title,rows,columns,actions,emptyMessage,count,footer}: {title:string;rows:T[];columns:DataColumn<T>[];actions?:(row:T)=>ReactNode;emptyMessage?:string;count?:number;footer?:ReactNode}){
 const [sort,setSort]=useState<{key:string;direction:1|-1}>();
 const column=columns.find(c=>c.key===sort?.key);const sorted=column?.sortValue&&sort?[...rows].sort((a,b)=>{const av=column.sortValue!(a),bv=column.sortValue!(b);return (typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv),'pt-BR',{numeric:true}))*sort.direction;}):rows;
 const headingId=useId();
 return <section className="card table-card operational-data-table ff-data-table" aria-labelledby={headingId}><div className="table-toolbar"><h2 id={headingId}>{title}</h2><span className="ff-result-count">{count??rows.length} {(count??rows.length)===1?'registro':'registros'}</span></div>{rows.length?<div className="ff-table-scroll" tabIndex={0} role="region" aria-label={`${title}: deslize para ver todas as colunas`}><table><thead><tr>{columns.map(c=><th key={c.key} scope="col" aria-sort={sort?.key===c.key?(sort.direction===1?'ascending':'descending'):undefined}>{c.sortValue?<button type="button" onClick={()=>setSort({key:c.key,direction:sort?.key===c.key&&sort.direction===1?-1:1})}>{c.label}<span aria-hidden="true">{sort?.key===c.key?(sort.direction===1?'↑':'↓'):'↕'}</span><span className="sr-only">Ordenar nesta página</span></button>:c.label}</th>)}{actions&&<th scope="col">Ações</th>}</tr></thead><tbody>{sorted.map(row=><tr key={String(row.id)}>{columns.map(c=><td key={c.key} data-label={c.label}>{c.render(row)}</td>)}{actions&&<td data-label="Ações"><div className="row-actions">{actions(row)}</div></td>}</tr>)}</tbody></table></div>:<EmptyState title={emptyMessage??'Nenhum registro encontrado'} description="Os registros aparecerão aqui quando estiverem disponíveis."/>}{footer}</section>;
}

export function Skeleton({label='Carregando dados…'}:{label?:string}){return <div className="card module-skeleton" role="status"><span className="sr-only">{label}</span>{[80,100,60].map((width,index)=><div key={index} className="skeleton-line" style={{'--skeleton-width':`${width}%`} as CSSProperties}/>)}</div>;}

export {useDialogFocus} from './dialogFocus';
