export type AttendanceSummaryInput = { attendance_status: string | null };

export function occurrenceAttendanceSummary(rows: AttendanceSummaryInput[]) {
  return {
    expected: rows.length,
    recorded: rows.filter((row) => row.attendance_status !== null).length,
    present: rows.filter((row) => row.attendance_status === "PRESENT" || row.attendance_status === "LATE").length,
    absences: rows.filter((row) => row.attendance_status === "ABSENT_JUSTIFIED" || row.attendance_status === "ABSENT_UNJUSTIFIED").length,
  };
}
