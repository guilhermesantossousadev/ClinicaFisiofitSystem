import type { CSSProperties } from 'react';
import { type CalendarItem, calendarTime, isSubstitution, responsibleName, statusLabel } from './calendarModel';
export function CalendarEventCard({ item, onOpen, style, compact = false }: { item: CalendarItem; onOpen: (item: CalendarItem) => void; style?: CSSProperties; compact?: boolean }) {
  const label = `${item.title}, ${calendarTime(item.startAt)} a ${calendarTime(item.endAt)}, ${responsibleName(item)}, ${statusLabel(item)}${isSubstitution(item) ? ', substituição' : ''}, abrir detalhes`;
  return <button type="button" className={`calendar-event ${item.sourceType === 'CLASS_OCCURRENCE' ? 'is-class' : 'is-appointment'} status-${item.status}${compact ? ' is-compact' : ''}`} style={style} onClick={() => onOpen(item)} aria-label={label} title={label} data-event-id={item.id}>
    <span className="calendar-event-time">{calendarTime(item.startAt)}–{calendarTime(item.endAt)} <span>{statusLabel(item)}</span></span>
    <strong>{item.title}</strong>
    <span className="calendar-event-meta">{responsibleName(item)}{isSubstitution(item) ? ' · Substituição' : ''}</span>
    {!compact && <span className="calendar-event-meta">{item.room?.name ?? 'Sala não informada'}{item.occupancy != null ? ` · ${item.occupancy} participantes` : ''}</span>}
  </button>;
}
