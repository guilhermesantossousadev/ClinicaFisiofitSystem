import {TextField, SelectField, CheckboxField, TextareaField} from "./FormPrimitives";
import {portalTokens} from "@fisiofit/design-system";
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {Notice,DataTable,Tabs,Button,FilterSummary} from '@fisiofit/design-system/react';
const render=(element:Parameters<typeof renderToStaticMarkup>[0])=>renderToStaticMarkup(element);
describe('Fisiofit Design System V2',()=>{
 it('announces a failed operation as an alert and never a success',()=>{
  const html=render(createElement(Notice,{message:'Erro: Sem conexão. Tente novamente.'}));
  expect(html).toContain('role="alert"');expect(html).toContain('aria-live="assertive"');expect(html).toContain('Não foi possível concluir');expect(html).not.toContain('Concluído');expect(html).not.toContain('✓');
 });
 it('keeps successful feedback and dismissal understandable',()=>{
  const html=render(createElement(Notice,{message:'Matrícula salva.',onDismiss:()=>{}}));
  expect(html).toContain('role="status"');expect(html).toContain('Matrícula salva.');expect(html).toContain('aria-label="Fechar mensagem"');
 });
 it('renders actual table headers and an unambiguous count',()=>{
  const html=render(createElement(DataTable<{id:string;name:string}>,{title:'Pacientes',rows:[{id:'synthetic',name:'Sintético'}],columns:[{key:'name',label:'Nome',render:r=>r.name,sortValue:r=>r.name}],actions:()=>createElement('button',{},'Editar')}));
  expect(html).toContain('<table>');expect(html).toContain('scope="col"');expect(html).toContain('Ordenar nesta página');expect(html).toContain('1 registro');expect(html).toContain('<td data-label="Nome">Sintético');
 });
 it('does not show fabricated rows or inactive sort controls in an empty table',()=>{
  const html=render(createElement(DataTable,{title:'Unidades',rows:[],columns:[],emptyMessage:'Nenhuma unidade cadastrada.'}));
  expect(html).toContain('0 registros');expect(html).toContain('Nenhuma unidade cadastrada.');expect(html).not.toContain('<tbody>');
 });
 it('links tabs to panels and includes only the active tab in the Tab sequence',()=>{
  const html=render(createElement(Tabs,{label:'Situação',id:'payments',items:[{value:'all',label:'Todos'},{value:'paid',label:'Pagos'}],value:'all',onChange:()=>{}}));
  expect(html).toContain('aria-controls="payments-panel-all" tabindex="0"');expect(html).toContain('aria-selected="false" aria-controls="payments-panel-paid" tabindex="-1"');
 });
 it('associates field errors with the control and retains required semantics',()=>{
  const html=render(createElement(TextField,{id:'synthetic-name',label:'Nome',name:'name',required:true,error:'Informe o nome completo.'}));
  expect(html).toContain('for="synthetic-name"');expect(html).toContain('aria-invalid="true"');expect(html).toContain('aria-describedby="synthetic-name-message"');expect(html).toContain('required=""');expect(html).toContain('id="synthetic-name-message"');
 });
 it('associates selector help without changing option values used by the API',()=>{
  const html=render(createElement(SelectField,{id:'synthetic-plan',label:'Plano',name:'plan_id',hint:'Escolha o plano contratado.',children:createElement('option',{value:'existing-plan'},'Plano existente')}));
  expect(html).toContain('aria-describedby="synthetic-plan-message"');expect(html).toContain('value="existing-plan"');expect(html).toContain('name="plan_id"');
 });
 it('meets AA contrast for semantic foregrounds on their actual surfaces',()=>{
  const luminance=(hex:string)=>{const c=hex.slice(1).match(/../g)!.map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
  const pairs=[['--ff-text','--ff-surface'],['--ff-muted','--ff-surface'],['--ff-primary','--ff-primary-soft'],['--ff-success','--ff-success-soft'],['--ff-danger','--ff-danger-soft'],['--ff-warning','--ff-warning-soft'],['--ff-surface','--ff-primary'],['--ff-control-border','--ff-surface']] as const;
  for(const[fg,bg]of pairs){const a=luminance(portalTokens[fg]),b=luminance(portalTokens[bg]);expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05),`${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);}
 });
});

describe('Fisiofit V2.1 shared interaction contracts', () => {
 it('keeps a plain Button inside a form from implicitly submitting', () => {
  expect(render(createElement(Button, {}, 'Abrir detalhes'))).toContain('type="button"');
  expect(render(createElement(Button, {type:'submit'}, 'Salvar alterações'))).toContain('type="submit"');
 });
 it('blocks repeat activation and names a pending action', () => {
  const html = render(createElement(Button, {variant:'primary',busy:true,busyLabel:'Registrando recebimento…'}, 'Registrar recebimento'));
  expect(html).toContain('disabled=""'); expect(html).toContain('aria-busy="true"');
  expect(html).toContain('Registrando recebimento…');
 });
 it('preserves semantic names for icon-only actions', () => {
  const html = render(createElement(Button, {iconOnly:true,'aria-label':'Fechar detalhes'}, '×'));
  expect(html).toContain('icon-button'); expect(html).toContain('aria-label="Fechar detalhes"');
 });
 it('retains caller descriptions and error state across every primitive', () => {
  for (const Component of [TextField, TextareaField, CheckboxField]) {
   const html = render(createElement(Component as typeof TextField, {id:'field',label:'Campo',hint:'Ajuda contextual','aria-describedby':'external-help','aria-invalid':true}));
   expect(html).toContain('aria-describedby="external-help field-message"');
   expect(html).toContain('aria-invalid="true"');
  }
 });
 it('aligns monetary headers and values without altering stored cents', () => {
  const html = render(createElement(DataTable<{id:string;amount:number}>, {title:'Cobranças',rows:[{id:'synthetic',amount:12345}],columns:[{key:'amount',label:'Valor cobrado',align:'end',render:r=>String(r.amount)}]}));
  expect(html).toContain('class="ff-cell-numeric" scope="col"');
  expect(html).toContain('class="ff-cell-numeric">12345');
  expect(html).toContain('<caption class="sr-only">Cobranças.');
 });
 it('shows applied filters with a result count and a real clearing action', () => {
  const html = render(createElement(FilterSummary, {count:0,filters:['Busca: Aurora','Em aberto'],onClear:()=>{}}));
  expect(html).toContain('0 resultados · Busca: Aurora · Em aberto');
  expect(html).toContain('Limpar filtros'); expect(html).toContain('aria-live="polite"');
  expect(render(createElement(FilterSummary, {count:1,filters:[],onClear:()=>{}}))).not.toContain('Limpar filtros');
 });
});
