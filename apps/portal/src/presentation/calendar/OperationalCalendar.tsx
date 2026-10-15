import { useEffect, useMemo, useState } from 'react';
import { CalendarTimeGrid, type CalendarColumn } from './CalendarTimeGrid';
import { CalendarEventCard } from './CalendarEventCard';
import { type CalendarItem, type CalendarPerson, calendarDate, calendarWeek, calendarStatuses, responsibleId, segmentsForDay, shiftCalendarDate } from './calendarModel';

type Props = { items: CalendarItem[]; professionals: CalendarPerson[]; rooms: CalendarPerson[]; date: string; onDate: (date: string) => void; mode: 'day' | 'week'; onMode: (mode: 'day' | 'week') => void; unitName: string; loading: boolean; error: string; retry: () => void; onOpen: (item: CalendarItem) => void };
const dateLabel = (date: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { ...options, timeZone: 'America/Sao_Paulo' }).format(new Date(date + 'T12:00:00-03:00'));
export function OperationalCalendar({ items, professionals, rooms, date, onDate, mode, onMode, unitName, loading, error, retry, onOpen }: Props) {
  const [filtersOpen, setFiltersOpen] = useState(() => window.innerWidth > 800);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [room, setRoom] = useState('');
  const [weekends, setWeekends] = useState(false);
  const [zoom, setZoom] = useState(108);
  const [groupBy, setGroupBy] = useState<'professionals' | 'rooms'>('professionals');
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60000); return () => window.clearInterval(timer); }, []);
  const people = useMemo(() => {
    const all = new Map(professionals.filter(p => p.id).map(p => [String(p.id), p.name ?? 'Profissional sem nome']));
    for (const item of items) all.set(responsibleId(item), item.actualProfessional?.name ?? item.professional?.name ?? item.plannedProfessional?.name ?? 'Sem profissional informado');
    return [...all].map(([id, name]) => ({ id, name }));
  }, [professionals, items]);
  const roomOptions = useMemo(() => {
    const all = new Map(rooms.filter(r => r.id).map(r => [String(r.id), r.name ?? 'Sala sem nome']));
    for (const item of items) if (item.room?.id) all.set(String(item.room.id), item.room.name ?? 'Sala sem nome');
    return [...all].map(([id, name]) => ({ id, name }));
  }, [rooms, items]);
  const selectedIds = selected ?? people.map(p => p.id);
  const filtered = items.filter(item => selectedIds.includes(responsibleId(item)) && (!status || item.status === status) && (!type || item.sourceType === type) && (!room || item.room?.id === room));
  const week = calendarWeek(date);
  const days = mode === 'day' ? [date] : week.filter((day, i) => i < 5 || weekends || segmentsForDay(items, day).length > 0 || day === date);
  const columns: CalendarColumn[] = mode === 'week' ? days.map(day => ({ id: day, date: day, title: dateLabel(day, { weekday: 'short', day: '2-digit' }), subtitle: dateLabel(day, { month: 'long' }), segments: segmentsForDay(filtered, day) })) : groupBy === 'rooms' ? [...roomOptions, ...(filtered.some(i => !i.room?.id) ? [{ id: 'unassigned', name: 'Sala não informada' }] : [])].filter(r => !room || r.id === room).map(r => ({ id: r.id, date, title: r.name, subtitle: dateLabel(date, { weekday: 'long', day: '2-digit', month: 'short' }), segments: segmentsForDay(filtered.filter(i => (i.room?.id ?? 'unassigned') === r.id), date) })) : people.filter(p => selectedIds.includes(p.id)).map(p => ({ id: p.id, date, title: p.name, subtitle: dateLabel(date, { weekday: 'long', day: '2-digit', month: 'short' }), segments: segmentsForDay(filtered.filter(i => responsibleId(i) === p.id), date) }));
  const visibleCount = new Set(days.flatMap(day => segmentsForDay(filtered, day).map(s => s.item.id))).size;
  const activeFilters = [selected !== null ? `${selectedIds.length} profissionais` : '', status ? calendarStatuses[status] ?? status : '', type ? type === 'CLASS_OCCURRENCE' ? 'Turmas' : 'Atendimentos' : '', room ? roomOptions.find(r => r.id === room)?.name : ''].filter(Boolean);
  const clear = () => { setSelected(null); setStatus(''); setType(''); setRoom(''); };
  return <section className="card operational-calendar" aria-label="Calendário operacional" aria-busy={loading}>
    <div className="calendar-toolbar">
      <div className="calendar-period"><p className="eyebrow">{unitName}</p><h2 aria-live="polite">{mode === 'day' ? dateLabel(date, { day: 'numeric', month: 'long', year: 'numeric' }) : `${dateLabel(week[0], { day: '2-digit', month: 'short' })} – ${dateLabel(days.at(-1) ?? week[4], { day: '2-digit', month: 'short', year: 'numeric' })}`}</h2></div>
      <div className="calendar-navigation" aria-label="Navegação do calendário"><button type="button" className="btn secondary" onClick={() => onDate(shiftCalendarDate(date, mode === 'day' ? -1 : -7))} aria-label={mode === 'day' ? 'Dia anterior' : 'Semana anterior'}>‹</button><button type="button" className="btn secondary" onClick={() => onDate(calendarDate(new Date()))}>Hoje</button><button type="button" className="btn secondary" onClick={() => onDate(shiftCalendarDate(date, mode === 'day' ? 1 : 7))} aria-label={mode === 'day' ? 'Próximo dia' : 'Próxima semana'}>›</button></div>
      <label className="calendar-date-picker">Ir para data<input type="date" value={date} onChange={e => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) onDate(e.target.value); }} /></label>
      <div className="segmented" aria-label="Visualização da agenda"><button type="button" aria-pressed={mode === 'day'} className={mode === 'day' ? 'selected' : ''} onClick={() => onMode('day')}>Dia</button><button type="button" aria-pressed={mode === 'week'} className={mode === 'week' ? 'selected' : ''} onClick={() => onMode('week')}>Semana</button><button type="button" aria-pressed={mode === 'day' && groupBy === 'professionals'} onClick={() => { setGroupBy('professionals'); onMode('day'); }}>Profissionais</button></div>
    </div>
    <div className="calendar-layout">
      <aside className="calendar-filters" aria-label="Filtros da agenda"><button type="button" className="calendar-filter-toggle" aria-expanded={filtersOpen} aria-controls="calendar-filter-fields" onClick={() => setFiltersOpen(value => !value)}>Filtros e profissionais · {selectedIds.length} {filtersOpen ? '▴' : '▾'}</button><div id="calendar-filter-fields" className={`calendar-filter-fields${filtersOpen ? '' : ' is-collapsed'}`}>
        <details open><summary>Profissionais <span>{selectedIds.length}</span></summary><div className="calendar-people-actions"><button type="button" onClick={() => setSelected(null)}>Todos</button><button type="button" onClick={() => setSelected([])}>Nenhum</button></div><div className="calendar-people">{people.map((person, index) => <label key={person.id}><input type="checkbox" checked={selectedIds.includes(person.id)} onChange={e => setSelected(e.target.checked ? [...selectedIds, person.id] : selectedIds.filter(id => id !== person.id))} /><span className={`calendar-avatar tone-${index % 3}`} aria-hidden="true">{person.name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('')}</span><span>{person.name}</span></label>)}</div></details>
        <label>Estado<select value={status} onChange={e => setStatus(e.target.value)}><option value="">Todos os estados</option>{Object.entries(calendarStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Tipo de sessão<select value={type} onChange={e => setType(e.target.value)}><option value="">Turmas e atendimentos</option><option value="CLASS_OCCURRENCE">Turmas</option><option value="APPOINTMENT">Atendimentos</option></select></label>
        {roomOptions.length > 0 && <label>Sala<select value={room} onChange={e => setRoom(e.target.value)}><option value="">Todas as salas</option>{roomOptions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>}
        <details className="calendar-preferences"><summary>Visualização</summary><label>Zoom vertical<select value={zoom} onChange={e => setZoom(Number(e.target.value))}><option value={84}>Compacto</option><option value={108}>Confortável</option><option value={144}>Ampliado</option></select></label><label className="calendar-check"><input type="checkbox" checked={weekends} onChange={e => setWeekends(e.target.checked)} />Mostrar sábado e domingo</label>{roomOptions.length > 0 && <label>Colunas no dia<select value={groupBy} onChange={e => setGroupBy(e.target.value as typeof groupBy)}><option value="professionals">Profissionais</option><option value="rooms">Salas · consulta</option></select></label>}</details>
        <p className="calendar-disclaimer">Espaços sem sessão não confirmam disponibilidade. Capacidade é informativa.</p>
      </div></aside>
      <div className="calendar-main"><div className="calendar-filter-summary" role="status"><span>{loading ? 'Carregando agenda…' : error ? 'Agenda indisponível' : `${visibleCount} ${visibleCount === 1 ? 'sessão' : 'sessões'} no período`}</span>{activeFilters.map(filter => <span className="calendar-filter-chip" key={filter}>{filter}</span>)}{activeFilters.length > 0 && <button type="button" onClick={clear}>Limpar filtros</button>}<span className="calendar-zone">Horário de Brasília</span></div>
        {loading ? <div className="calendar-state" role="status"><h3>Carregando os horários</h3><p>Aguarde a consulta da unidade selecionada.</p></div> : error ? <div className="calendar-state" role="alert"><h3>Não foi possível carregar a agenda</h3><p>{error}</p><button type="button" className="btn secondary" onClick={retry}>Tentar novamente</button></div> : selectedIds.length === 0 ? <div className="calendar-state"><h3>Selecione um profissional</h3><p>Escolha um ou mais profissionais para comparar seus horários.</p><button type="button" className="btn secondary" onClick={() => setSelected(null)}>Mostrar todos</button></div> : <>
          {!visibleCount && <p className="calendar-empty" role="status">Nenhuma sessão neste período{activeFilters.length ? ' com os filtros aplicados' : ''}.</p>}
          {columns.length > 0 && <CalendarTimeGrid columns={columns} zoom={zoom} onOpen={onOpen} now={now} context={`${date}:${mode}:${groupBy}`} />}
          <div className="calendar-chronological" aria-label="Sessões em ordem de horário">{days.map(day => <section key={day}><h3>{dateLabel(day, { weekday: 'long', day: '2-digit', month: 'short' })}</h3>{segmentsForDay(filtered, day).map(s => <CalendarEventCard key={s.item.id} item={s.item} onOpen={onOpen} />)}{!segmentsForDay(filtered, day).length && <p>Nenhuma sessão nesta data.</p>}</section>)}</div>
        </>}
        <div className="calendar-legend" aria-label="Legenda da agenda"><span>▌ Turma recorrente</span><span>▌ Atendimento individual</span><span>Estados e substituições identificados por texto</span></div>
      </div>
    </div>
  </section>;
}
