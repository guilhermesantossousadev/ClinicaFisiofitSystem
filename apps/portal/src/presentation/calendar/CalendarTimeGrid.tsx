import { useEffect, useRef, type CSSProperties } from 'react';
import { CalendarEventCard } from './CalendarEventCard';
import { type CalendarItem, type CalendarSegment, calendarDate, calendarTime, positionSegments, timeBounds } from './calendarModel';
export type CalendarColumn = { id: string; title: string; subtitle: string; date: string; segments: CalendarSegment[] };
export function CalendarTimeGrid({ columns, zoom, onOpen, now, context }: { columns: CalendarColumn[]; zoom: number; onOpen: (item: CalendarItem) => void; now: Date; context: string }) {
  const scroll = useRef<HTMLDivElement>(null);
  const { start, end } = timeBounds(columns.flatMap(c => c.segments));
  const hourHeight = zoom, height = (end - start) / 60 * hourHeight;
  const currentMinute = Number(calendarTime(now).slice(0, 2)) * 60 + Number(calendarTime(now).slice(3));
  useEffect(() => {
    const first = Math.min(...columns.flatMap(c => c.segments.map(s => s.start)));
    if (scroll.current) scroll.current.scrollTop = Number.isFinite(first) ? Math.max(0, (first - start) / 60 * hourHeight - 32) : 0;
    // Scroll once on period/scope changes; opening a panel and zooming preserve position.
  }, [context]);
  const hours = Array.from({ length: (end - start) / 60 + 1 }, (_, i) => start + i * 60);
  return <div ref={scroll} className="calendar-time-scroll" role="region" aria-label="Grade de horários; role para explorar" tabIndex={0}>
    <div className="calendar-time-grid" style={{ '--calendar-columns': columns.length, '--calendar-hour': `${hourHeight}px` } as CSSProperties}>
      <div className="calendar-corner">Horário</div>
      {columns.map(column => <div className={`calendar-column-heading${column.date === calendarDate(now) ? ' is-today' : ''}`} key={column.id}><strong>{column.title}</strong><span>{column.subtitle}</span></div>)}
      <div className="calendar-hours" style={{ height }}>{hours.map(minute => <span key={minute} style={{ top: (minute - start) / 60 * hourHeight }}>{String(minute / 60).padStart(2, '0')}:00</span>)}</div>
      {columns.map(column => <div key={column.id} className="calendar-time-column" role="group" aria-label={`${column.title}, ${column.subtitle}`} style={{ height }}>
        {positionSegments(column.segments).map(segment => <CalendarEventCard key={segment.item.id} item={segment.item} compact={(segment.end - segment.start) / 60 * hourHeight < 96} onOpen={onOpen} style={{ top: (segment.start - start) / 60 * hourHeight, height: (segment.end - segment.start) / 60 * hourHeight, left: `calc(${segment.lane / segment.lanes * 100}% + 3px)`, width: `calc(${100 / segment.lanes}% - 6px)` }} />)}
        {column.date === calendarDate(now) && currentMinute >= start && currentMinute <= end && <div className="calendar-now" role="img" style={{ top: (currentMinute - start) / 60 * hourHeight }} aria-label={`Agora, ${calendarTime(now)}`}><span /></div>}
      </div>)}
    </div>
  </div>;
}
