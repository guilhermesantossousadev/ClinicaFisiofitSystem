// Focused regressions. Uses only the same synthetic fixture server as the visual suite.
export async function runRefinementChecks({go,fill,click,key,wait,evaluate,send,shot,resize,checks,pause,setSearchDelay,getRequests,setDelay,setReportScopeFixture}) {
 const check=async(name,expression)=>{const passed=await evaluate(expression);checks.push({name,passed:Boolean(passed)});if(!passed)throw Error('Refinement assertion failed: '+name);};
 await go('Pacientes');await click('Novo paciente','.drawer-create-trigger');
 await evaluate("document.querySelector('[name=name]').focus()");await key('Tab');
 await check('Untouched required fields are not marked invalid on first blur',"!document.querySelector('[name=name]').hasAttribute('aria-invalid')");
 await evaluate("document.querySelector('[name=email]').focus()");await fill('[name=email]','email-incompleto');
 await check('Email is not validated while the user types',"document.querySelector('[name=email]').getAttribute('aria-invalid')!=='true'");
 await key('Tab');
 await check('Invalid email has a specific associated message after blur',"(()=>{const e=document.querySelector('[name=email]');return e.getAttribute('aria-invalid')==='true'&&document.getElementById(e.id+'-error')?.innerText.includes('e-mail válido')&&e.getAttribute('aria-describedby').includes(e.id+'-error')})()");
 await fill('[name=email]','synthetic@example.invalid');
 await check('Correcting the email clears its error without another submit',"document.querySelector('[name=email]').getAttribute('aria-invalid')!=='true'");
 await fill('[name=name]','Cadastro preservado');await click('Cadastrar paciente','[role=dialog] button');
 await wait("Boolean(document.querySelector('[role=alertdialog]'))",'navigable validation summary');
 await click('Revisar primeiro campo','[role=alertdialog] button');
 await check('Error summary focuses the invalid field and preserves entered values',"document.activeElement.name==='primary_unit_id'&&document.querySelector('[name=name]').value==='Cadastro preservado'&&document.querySelector('[name=email]').value==='synthetic@example.invalid'");
 await key('Escape');await click('Descartar alterações','.ff-decision button');
 await click('Novo paciente','.drawer-create-trigger');
 await check('Reopening a discarded form starts without stale field errors',"!document.querySelector('[role=dialog] [aria-invalid=true]')");await key('Escape');

 await go('Prontuários');
 const picker='.record-selector input[role=combobox]';
 await evaluate(`document.querySelector(${JSON.stringify(picker)}).focus()`);await fill(picker,'Aurora');
 await wait("Boolean(document.querySelector('.record-selector [role=option]'))",'explicit selection options');
 await check('Typed patient name is pending selection, not a premature error',"!document.querySelector('.record-selector input[type=hidden]').value&&document.querySelector('.record-selector').innerText.includes('Nome digitado')&&document.querySelector('.record-selector input[role=combobox]').getAttribute('aria-invalid')!=='true'");
 await key('Enter');
 await check('Enter without an active result does not implicitly select a patient',"!document.querySelector('.record-selector input[type=hidden]').value");
 await key('ArrowDown');
 await check('Keyboard navigation identifies the active patient result',"(()=>{const e=document.querySelector('.record-selector input[role=combobox]');return document.getElementById(e.getAttribute('aria-activedescendant'))?.getAttribute('aria-selected')==='true'})()");
 await key('Enter');await pause(150);
 await check('Keyboard selection sets the submitted patient and announces selection',"Boolean(document.querySelector('.record-selector input[type=hidden]').value)&&document.querySelector('.patient-picker-selected')?.innerText.includes('Aurora')&&document.querySelector('.record-selector input[role=combobox]').getAttribute('aria-expanded')==='false'");
 await shot('picker-selected-1440');
 await fill(picker,'Beatriz');
 await check('Editing a selected name immediately clears the submitted patient ID',"!document.querySelector('.record-selector input[type=hidden]').value");
 await wait("Boolean(document.querySelector('.record-selector [role=option]'))",'second patient options');
 await key('Escape');
 await check('Escape closes the combobox and keeps its input focused',"document.activeElement.getAttribute('role')==='combobox'&&document.activeElement.getAttribute('aria-expanded')==='false'&&!document.querySelector('.record-selector [role=option]')");
 await key('ArrowDown');await wait("Boolean(document.querySelector('.record-selector [role=option]'))",'reopened options');await key('ArrowDown');await key('Enter');
 await check('Reopened search requires explicit keyboard selection',"Boolean(document.querySelector('.record-selector input[type=hidden]').value)");
 // Observe a slow old query, then a faster new query under identical fixture semantics.
 setSearchDelay('Aurora',1100);
 await fill(picker,'Aurora');await fill(picker,'Beatriz');
 await wait("document.querySelector('.record-selector [role=option]')?.innerText.includes('Beatriz')",'new query wins');await pause(1200);
 await check('Delayed results cannot replace results from a newer patient query',"[...document.querySelectorAll('.record-selector [role=option]')].every(e=>e.innerText.includes('Beatriz'))");
 setSearchDelay('',0);
 await fill(picker,'B');
 await check('Shortening a query clears old options and the loading indicator',"!document.querySelector('.record-selector [role=option]')&&document.querySelector('.record-selector input[role=combobox]').getAttribute('aria-busy')==='false'");
 await go('Matrículas');await click('Matrículas','.enrollment-module-nav button');await click('Nova matrícula','.drawer-create-trigger');
 const enrollmentPicker='[role=dialog] input[role=combobox]';
 await evaluate(`document.querySelector(${JSON.stringify(enrollmentPicker)}).focus()`);await fill(enrollmentPicker,'Aurora');await wait("Boolean(document.querySelector('[role=dialog] [role=option]'))",'modal picker');
 await key('Escape');
 await check('First Escape closes patient options and keeps the enrollment dialog open',"Boolean(document.querySelector('[role=dialog]'))&&!document.querySelector('.ff-decision')&&document.activeElement.getAttribute('role')==='combobox'");
 await key('Escape');await click('Descartar alterações','.ff-decision button');

 await go('Matrículas');await click('Corrigir cobrança');
 await fill('textarea[name=reason]','Justificativa sintética que será preservada.');await key('Escape');
 await wait("Boolean(document.querySelector('.ff-decision'))",'financial draft confirmation');
 await check('Financial discard is visually destructive and has an explicit label',"document.querySelector('.ff-decision .btn.danger')?.textContent==='Descartar alterações'");
 await click('Voltar','.ff-decision button');
 await check('Cancelling financial discard preserves justification and focus in the dialog',"document.querySelector('textarea[name=reason]')?.value==='Justificativa sintética que será preservada.'&&Boolean(document.activeElement.closest('[role=dialog]'))");
 await key('Escape');await click('Descartar alterações','.ff-decision button');
 await click('Pagos','[role=tab]');
 await check('Active financial filters are visible alongside result counts',"document.querySelector('.ff-filter-summary')?.innerText.includes('0 resultados · Pagos')");
 await click('Limpar filtros','.ff-filter-summary button');
 await check('Clear filters restores both the selected status and visible results',"document.querySelector('[role=tab][aria-selected=true]')?.innerText.includes('Todos')&&document.querySelector('.ff-filter-summary')?.innerText.includes('1 resultado')");
 await shot('filters-cleared-1440');

 await go('Pacientes');await click('Editar','.row-actions button');
 await fill('[name=name]','Nome sintético alterado');await fill('[name=email]','email-invalido');await click('Salvar alterações','[role=dialog] button');await wait("Boolean(document.querySelector('[role=alertdialog]'))",'edit validation');await key('Escape');
 await key('Escape');await click('Descartar alterações','.ff-decision button');
 await click('Inativar','.row-actions button');
 await check('Inactivation confirmation names its consequence and offers safe initial focus',"document.querySelector('.ff-decision .btn.danger')?.innerText==='Inativar cadastro'&&document.activeElement?.innerText==='Voltar'");await key('Escape');

 // Valid create and pending-state regression in synthetic data only.
 await go('Pacientes');await click('Novo paciente','.drawer-create-trigger');
 await fill('[name=name]','Paciente inteiramente sintético');await fill('[name=primary_unit_id]','f2000000-0000-4000-8000-000000000001');
 const countBefore=getRequests().filter(r=>r.method==='POST'&&r.path.endsWith('/patients')).length;
 setDelay(1000);await click('Cadastrar paciente','[role=dialog] button');
 await check('Patient creation exposes a pending state before reporting success',"document.querySelector('[role=dialog] button[aria-busy=true]')?.disabled&&!document.querySelector('[role=dialog] .ff-notice-success')");
 await click('Cadastrar paciente','[role=dialog] button');setDelay(0);
 await wait("document.querySelector('[role=dialog] .ff-notice-success')?.innerText.includes('Paciente cadastrado')",'patient creation confirmed');
 const singleCreate=getRequests().filter(r=>r.method==='POST'&&r.path.endsWith('/patients')).length===countBefore+1;
 checks.push({name:'Repeated patient submit sends exactly one creation request',passed:singleCreate});if(!singleCreate)throw Error('Duplicate synthetic creation request');
 await check('Confirmed creation resets the form and reports success',"document.querySelector('[role=dialog] [name=name]').value===''");
 await key('Escape');
 await go('Matrículas');await click('Trocar plano');
 await fill('[name=plan_id]','f2000000-0000-4000-8000-000000000004a');await fill('textarea[name=reason]','Justificativa sintética para revisar a troca.');await click('Ver impacto da troca');
 await wait("document.body.innerText.includes('Impacto da troca')",'fresh plan preview');
 await fill('textarea[name=reason]','Outra justificativa sintética para a troca.');
 await check('Editing plan-change input invalidates its earlier impact preview',"!document.body.innerText.includes('Impacto da troca')&&[...document.querySelectorAll('[role=dialog] button')].some(e=>e.innerText==='Ver impacto da troca')");
 await key('Escape');await click('Descartar alterações','.ff-decision button');

 setReportScopeFixture(true);
 await go('Relatórios');await wait("document.querySelector('.metrics')?.innerText.includes('111,00')",'unit-scoped report');
 const reportRequests=()=>getRequests().filter(r=>r.path.endsWith('/reports/annual'));
 const beforeYear=reportRequests().length;
 await fill('.report-year-filter input','2025');
 checks.push({name:'Typing an annual report year does not request partial values',passed:reportRequests().length===beforeYear});
 await click('Consultar ano');await wait("document.querySelector('.metrics')?.innerText.includes('2025')",'applied year');
 setDelay(800);await fill('select[aria-label="Selecionar unidade ativa"]','');
 await check('Changing unit immediately hides the report from the previous scope',"!document.querySelector('.metrics')?.innerText.includes('111,00')");
 setDelay(0);await wait("document.querySelector('.metrics')?.innerText.includes('222,00')",'new report scope');
 await check('Changing unit reloads the annual report and retains its applied year',"document.querySelector('.report-year-filter input').value==='2025'&&document.querySelector('.metrics').innerText.includes('222,00')");
 checks.push({name:'Annual report request uses the currently selected scope',passed:!new URLSearchParams(reportRequests().at(-1).query).has('unitId')});
 setReportScopeFixture(false);

 // Desktop 200% text enlargement in a half-width layout, plus narrow mobile reflow.
 await resize(720);await go('Pacientes');await evaluate("document.documentElement.style.fontSize='200%'");
 await shot('text-zoom-200-patients-720',720);
 await check('200 percent text enlargement retains labels and viewport containment',"document.documentElement.scrollWidth<=innerWidth+2&&Boolean(document.querySelector('label[for=patient-search-input]'))");
 await click('Novo paciente','.drawer-create-trigger');await shot('text-zoom-200-form-720',720);
 await check('200 percent text enlargement keeps the patient dialog contained',"(()=>{const r=document.querySelector('[role=dialog]').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+2})()");await key('Escape');
 await evaluate("document.documentElement.style.fontSize=''");await resize(390);await go('Matrículas');await shot('financial-filters-390',390);
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await check('Reduced motion preference is respected by interactive components',"matchMedia('(prefers-reduced-motion: reduce)').matches&&parseFloat(getComputedStyle(document.querySelector('.btn')).transitionDuration)<=0.001");
 await send('Emulation.setEmulatedMedia',{features:[]});await resize(1440);
}
