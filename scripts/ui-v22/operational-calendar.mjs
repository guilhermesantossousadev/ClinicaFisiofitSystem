// Extra checks for the existing disposable Auth/RLS/runtime acceptance.
// Receives synthetic accounts in memory; never writes credentials to evidence.
export async function calendarAcceptance({ evaluate,wait,fill,clickText,send,shot,sql,fixture,accounts,admin,checks,idle,setStage }) {
 const assert=(ok,label)=>{if(!ok)throw Error('Calendar operational assertion: '+label);checks.push(label);};
 const tables=['class_memberships','occurrence_participants','attendances','attendance_revisions','appointments','enrollments','charges','payments'];
 const fingerprint=()=>sql(`select md5(concat_ws('|',${tables.map(t=>`(select coalesce(string_agg(row_to_json(t)::text,'' order by row_to_json(t)::text),'') from public.${t} t)`).join(',')}))`);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());
 const future=new Date(Date.parse(today+'T12:00:00Z')+70*86400000).toISOString().slice(0,10);
 const count=()=>Number(sql('select count(*) from public.class_occurrences'));
 await clickText('Agenda','.nav-item');await fill('select[aria-label="Selecionar unidade ativa"]',fixture.unit);await wait("Boolean(document.querySelector('.operational-calendar'))&&!document.querySelector('.operational-calendar[aria-busy=true]')",'real calendar');
 await clickText('Dia','.operational-calendar button');
 const before=fingerprint(),occurrences=count();
 await fill('.calendar-date-picker input',future);
 await wait("!document.querySelector('.operational-calendar[aria-busy=true]')&&Boolean(document.querySelector('.calendar-time-column .calendar-event'))",'future recurring Class');
 assert(count()>occurrences,'Normal calendar query materializes legitimate future occurrences');
 assert(fingerprint()===before,'Generation does not alter memberships, participants, attendance, appointments or finances');
 const generated=count();
 await fill('.calendar-date-picker input',today);
 await wait("!document.querySelector('.operational-calendar[aria-busy=true]')&&Boolean(document.querySelector('.calendar-time-column .calendar-event'))",'return to today');
 await clickText('Semana','.operational-calendar button');await clickText('Dia','.operational-calendar button');
 await evaluate("(()=>{const e=document.querySelector('.calendar-time-column .calendar-event');e.focus();e.click()})()");
 await wait("Boolean(document.querySelector('.occurrence-details'))",'real occurrence panel');
 await clickText('Participantes (2)','.occurrence-panel-tabs button');
 assert(await evaluate("document.querySelector('.occurrence-participants').innerText.includes('Synthetic Alpha')&&document.querySelector('.occurrence-participants').innerText.includes('Synthetic Gamma')"),'Calendar drawer uses the persisted effective Class roster');
 await clickText('Abrir chamada');await wait("Boolean(document.querySelector('.occurrence-attendance-list'))",'calendar attendance');
 assert(await evaluate("document.querySelectorAll('.occurrence-attendance-list>li').length===2"),'Calendar attendance reuses the authorized occurrence roster');
 await shot('browser-calendar-attendance');
 await clickText('Voltar aos detalhes','.modal-actions button');await clickText('Fechar','.occurrence-details-panel .modal-actions button');
 assert(fingerprint()===before&&count()===generated,'Navigation, panel, participants and attendance consultation preserve all operational records');
 for(const [role,account] of Object.entries(accounts)) {
  await idle();setStage('logout before '+role);
  await evaluate("document.querySelector('button[aria-label=Sair]').click()");await wait("Boolean(document.querySelector('input[type=email]'))",'calendar role logout');
  setStage(role+' login and consultation');await fill('input[type=email]',account.email);await fill('input[type=password]',account.password);await clickText('Entrar com segurança');await wait("Boolean(document.querySelector('.workspace'))&&!document.querySelector('.app-shell[aria-busy=true]')",'calendar role login');
  await clickText('Agenda','.nav-item');await fill('select[aria-label="Selecionar unidade ativa"]',fixture.unit);
  await wait("Boolean(document.querySelector('.calendar-time-column .calendar-event'))",role+' calendar');
  await clickText('Dia','.operational-calendar button');await evaluate("document.querySelector('.calendar-time-column .calendar-event').click()");await wait("Boolean(document.querySelector('.occurrence-details'))",role+' occurrence');
  assert(await evaluate(role==='professional'?"!document.querySelector('.occurrence-details').innerText.includes('Alterar somente esta aula')":"document.querySelector('.occurrence-details').innerText.includes('Alterar somente esta aula')"),role+' has authorized contextual calendar actions');
  await clickText('Abrir chamada');await wait("Boolean(document.querySelector('.occurrence-attendance-list'))",role+' attendance');
  assert(await evaluate("document.querySelectorAll('.occurrence-attendance-list>li').length===2"),role+' reads its authorized Class attendance');
  await shot('browser-calendar-'+role);
  await clickText('Voltar aos detalhes','.modal-actions button');await clickText('Fechar','.occurrence-details-panel .modal-actions button');
 }
 assert(fingerprint()===before,'Reception and assigned professional consultation introduce no operational mutation');
 await idle();setStage('logout before admin restoration');
 // Restore the pre-existing acceptance runner's admin context and dashboard.
 await evaluate("document.querySelector('button[aria-label=Sair]').click()");await wait("Boolean(document.querySelector('input[type=email]'))",'restore admin logout');
 setStage('admin restoration');await fill('input[type=email]',admin.email);await fill('input[type=password]',admin.password);await clickText('Entrar com segurança');await wait("Boolean(document.querySelector('.workspace'))&&!document.querySelector('.app-shell[aria-busy=true]')",'restore admin');
 await fill('select[aria-label="Selecionar unidade ativa"]',fixture.unit);await clickText('Painel','.nav-item');await wait("document.body.innerText.includes('Synthetic operating class')",'restored dashboard');await idle();setStage('existing acceptance');
}
