import {useEffect,useState} from 'react';
import {useDialogFocus,Icon} from '@fisiofit/design-system/react';
import {TextareaField} from './FormPrimitives';

type DecisionOptions={confirmLabel?:string;title?:string;destructive?:boolean};
type Decision=DecisionOptions&{message:string;mode:'confirm'|'text';resolve:(value:string|boolean|null)=>void};
let active:Decision|null=null;
const listeners=new Set<()=>void>();
const publish=()=>listeners.forEach(listener=>listener());
function request(message:string,mode:Decision['mode'],options:DecisionOptions={}):Promise<string|boolean|null>{
 // A repeated click cannot schedule the same sensitive operation a second time.
 if(active)return Promise.resolve(mode==='confirm'?false:null);
 return new Promise(resolve=>{active={message,mode,resolve,...options};publish();});
}
export async function confirmAction(message:string,options:DecisionOptions={}){return (await request(message,'confirm',options))===true;}
export async function requestText(message:string){const result=await request(message,'text');return typeof result==='string'?result:null;}
export function DecisionHost(){
 const [decision,setDecision]=useState<Decision|null>(active);
 const [text,setText]=useState('');
 function finish(result:string|boolean|null){const current=active;active=null;publish();setText('');current?.resolve(result);}
 useEffect(()=>{const listener=()=>{setDecision(active);setText('');};listeners.add(listener);return()=>{listeners.delete(listener);};},[]);
 const ref=useDialogFocus(Boolean(decision),()=>finish(null));
 if(!decision)return null;
 const minimum=Number(decision.message.match(/mínimo(?: de)? (\d+)|mín\.\s*(\d+)/i)?.slice(1).find(Boolean)??1);
 return <div className="edit-dialog-backdrop"><section ref={ref} className="edit-dialog ff-decision" role="alertdialog" aria-modal="true" aria-labelledby="decision-title" aria-describedby="decision-description"><div className="edit-dialog-header"><div><p className="eyebrow">{decision.mode==='text'?'INFORMAÇÃO NECESSÁRIA':'CONFIRMAÇÃO'}</p><h2 id="decision-title">{decision.title??(decision.mode==='text'?'Informe os detalhes':'Confirme antes de continuar')}</h2></div><button type="button" className="dialog-close" aria-label="Fechar confirmação" onClick={()=>finish(null)}><Icon name="close"/></button></div><form className="modal-form" onSubmit={e=>{e.preventDefault();finish(decision.mode==='text'?text:true);}}><p id="decision-description">{decision.message}</p>{decision.mode==='text'&&<TextareaField label="Detalhes" value={text} onChange={e=>setText(e.target.value)} minLength={minimum} maxLength={10000} required hint={`Informe pelo menos ${minimum} ${minimum===1?'caractere':'caracteres'}.`}/>}<div className="edit-dialog-actions"><button type="button" className="btn secondary" data-initial-focus onClick={()=>finish(null)}>Voltar</button><button type="submit" className={`btn ${decision.destructive?'danger':'primary'}`} disabled={decision.mode==='text'&&text.trim().length<minimum}>{decision.mode==='text'?'Usar informação':decision.confirmLabel??'Confirmar ação'}</button></div></form></section></div>;
}
