import { describe, expect, it } from 'vitest';
import { calendarDate, calendarTime, calendarWeek, isSubstitution, positionSegments, responsibleId, segmentsForDay, shiftCalendarDate, timeBounds, type CalendarItem } from './calendarModel';
const item = (id: string, start = '08:00', end = '09:00', extra: Partial<CalendarItem> = {}): CalendarItem => ({ id, sourceId: id, sourceType: 'CLASS_OCCURRENCE', unitId: 'A', title: id, status: 'planned', startAt: `2026-10-15T${start}:00-03:00`, endAt: `2026-10-15T${end}:00-03:00`, ...extra });
describe('calendar civil time and interval layout', () => {
  it('keeps São Paulo dates and real minute offsets across UTC midnight', () => {
    expect(calendarDate('2026-10-16T01:15:00Z')).toBe('2026-10-15');
    expect(calendarTime('2026-10-16T01:15:00Z')).toBe('22:15');
    const segments = segmentsForDay([item('late', '22:15', '23:45')], '2026-10-15');
    expect(segments.map(s => [s.start, s.end])).toEqual([[1335, 1425]]);
    expect(timeBounds(segments)).toEqual({ start: 360, end: 1440 });
  });
  it('starts operational weeks on Monday across month and year boundaries', () => {
    expect(calendarWeek('2027-01-03')).toEqual(['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']);
    expect(shiftCalendarDate('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('clips an overnight event into both days without changing its duration', () => {
    const overnight = item('night', '23:30', '23:59', { endAt: '2026-10-16T00:30:00-03:00' });
    expect(segmentsForDay([overnight], '2026-10-15').map(s => [s.start,s.end])).toEqual([[1410,1440]]);
    expect(segmentsForDay([overnight], '2026-10-16').map(s => [s.start,s.end])).toEqual([[0,30]]);
    expect(segmentsForDay([overnight], '2026-10-17')).toEqual([]);
    expect(timeBounds(segmentsForDay([overnight], '2026-10-16')).start).toBe(0);
  });
  it('uses half-open intervals; adjacent sessions share a lane', () => {
    const result = positionSegments(segmentsForDay([item('a'), item('b','09:00','10:00')], '2026-10-15'));
    expect(result.map(s => [s.lane,s.lanes])).toEqual([[0,1],[0,1]]);
  });
  it('keeps simultaneous and transitive overlaps distinguishable, independent of input order', () => {
    const input = [item('c','09:30','10:30'),item('a','08:00','10:00'),item('b','08:30','09:30'),item('d','08:45','09:15'),item('e','11:00','12:00')];
    const result = positionSegments(segmentsForDay(input,'2026-10-15'));
    expect(result.slice(0,4).every(s => s.lanes === 3)).toBe(true);
    expect(result.at(-1)?.lanes).toBe(1);
    for (const a of result) for (const b of result) if (a !== b && a.start < b.end && b.start < a.end) expect(a.lane).not.toBe(b.lane);
    expect(result).toEqual(positionSegments(segmentsForDay([...input].reverse(),'2026-10-15')));
  });
  it('does not invent sessions or accept invalid intervals', () => {
    expect(segmentsForDay([item('bad','09:00','08:00'),item('invalid','08:00','09:00',{startAt:'bad'})], '2026-10-15')).toEqual([]);
    expect(timeBounds([])).toEqual({start:360,end:1260});
  });
  it('attributes a substituted class to the effective professional', () => {
    const substituted = item('s','08:00','09:00',{ plannedProfessional: { id:'original' }, professional: { id:'original' }, actualProfessional: { id:'substitute' } });
    expect(responsibleId(substituted)).toBe('substitute'); expect(isSubstitution(substituted)).toBe(true);
    expect(isSubstitution(item('regular'))).toBe(false);
    expect(responsibleId(item('unassigned'))).toBe('unassigned');
  });
});
