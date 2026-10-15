/** Presentation only. The authorized calendar projection remains the source of truth. */
export type CalendarPerson = { id?: string; name?: string };
export type CalendarItem = {
  id: string; sourceType: 'CLASS_OCCURRENCE' | 'APPOINTMENT'; sourceId: string; unitId: string;
  startAt: string; endAt: string; status: string; title: string;
  professional?: CalendarPerson | null; plannedProfessional?: CalendarPerson | null; actualProfessional?: CalendarPerson | null;
  patient?: CalendarPerson | null; class?: CalendarPerson | null; service?: CalendarPerson | null; room?: CalendarPerson | null;
  occupancy?: number | null; capacity?: number | null;
};
export const CLINIC_ZONE = 'America/Sao_Paulo';
export const calendarDate = (raw: string | Date) => new Intl.DateTimeFormat('en-CA', { timeZone: CLINIC_ZONE }).format(new Date(raw));
export const calendarTime = (raw: string | Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: CLINIC_ZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(raw));
export function shiftCalendarDate(date: string, days: number) {
  return new Date(Date.parse(date + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10);
}
export function calendarWeek(date: string) {
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
  const monday = shiftCalendarDate(date, -((weekday + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => shiftCalendarDate(monday, i));
}
export const responsibleId = (item: CalendarItem) => item.actualProfessional?.id ?? item.professional?.id ?? item.plannedProfessional?.id ?? 'unassigned';
export const responsibleName = (item: CalendarItem) => item.actualProfessional?.name ?? item.professional?.name ?? item.plannedProfessional?.name ?? 'Sem profissional informado';
export const isSubstitution = (item: CalendarItem) => Boolean(item.actualProfessional?.id && item.plannedProfessional?.id && item.actualProfessional.id !== item.plannedProfessional.id);
export const calendarStatuses: Record<string, string> = { planned: 'Planejada', in_progress: 'Em andamento', scheduled: 'Agendado', confirmed: 'Confirmado', attending: 'Em atendimento', completed: 'Concluído', missed: 'Falta', cancelled: 'Cancelada', blocked: 'Horário bloqueado' };
export const statusLabel = (item: CalendarItem) => calendarStatuses[item.status] ?? item.status;
export type CalendarSegment = { item: CalendarItem; start: number; end: number };
/** Clip overnight events at each civil day, preserving actual instants and duration. */
export function segmentsForDay(items: CalendarItem[], date: string): CalendarSegment[] {
  const from = Date.parse(date + 'T00:00:00-03:00'), to = from + 86400000;
  return items.flatMap(item => {
    const start = Date.parse(item.startAt), end = Date.parse(item.endAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || start >= to || end <= from) return [];
    return [{ item, start: (Math.max(start, from) - from) / 60000, end: (Math.min(end, to) - from) / 60000 }];
  }).sort((a, b) => a.start - b.start || a.end - b.end || a.item.id.localeCompare(b.item.id));
}
export function timeBounds(segments: CalendarSegment[]) {
  return { start: Math.floor(Math.min(360, ...segments.map(s => s.start)) / 60) * 60, end: Math.ceil(Math.max(1260, ...segments.map(s => s.end)) / 60) * 60 };
}
export type PositionedSegment = CalendarSegment & { lane: number; lanes: number };
/** Interval partitioning: distinguish overlaps, without declaring a business conflict. */
export function positionSegments(segments: CalendarSegment[]): PositionedSegment[] {
  const result: PositionedSegment[] = [];
  let cluster: PositionedSegment[] = [], ends: number[] = [], clusterEnd = -1;
  const finish = () => { for (const segment of cluster) segment.lanes = ends.length; cluster = []; ends = []; };
  for (const segment of [...segments].sort((a, b) => a.start - b.start || a.end - b.end || a.item.id.localeCompare(b.item.id))) {
    if (segment.start >= clusterEnd) finish();
    let lane = ends.findIndex(end => end <= segment.start);
    if (lane < 0) lane = ends.length;
    ends[lane] = segment.end;
    const placed = { ...segment, lane, lanes: 1 }; cluster.push(placed); result.push(placed); clusterEnd = Math.max(clusterEnd, segment.end);
  }
  finish(); return result;
}
