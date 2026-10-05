import { describe, expect, it } from "vitest";
import { occurrenceAttendanceSummary } from "./occurrenceAttendance";

describe("occurrence attendance summary", () => {
  it("uses the occurrence roster as expected count and counts only recorded presence/absence", () => {
    expect(occurrenceAttendanceSummary([
      { attendance_status: "PRESENT" },
      { attendance_status: "LATE" },
      { attendance_status: "ABSENT_UNJUSTIFIED" },
      { attendance_status: null },
    ])).toEqual({ expected: 4, recorded: 3, present: 2, absences: 1 });
  });

  it("does not invent attendance for an empty or unrecorded roster", () => {
    expect(occurrenceAttendanceSummary([])).toEqual({ expected: 0, recorded: 0, present: 0, absences: 0 });
    expect(occurrenceAttendanceSummary([{ attendance_status: null }])).toEqual({ expected: 1, recorded: 0, present: 0, absences: 0 });
  });
});
