export type RosterMembership = {
  id: string;
  patient_id: string;
  effective_from: string;
  effective_to: string | null;
  weekdays: string[] | null;
  patient?: { id: string; name: string; active?: boolean; deleted_at?: string | null } | null;
};

export type PersistedOccurrenceParticipant = {
  id: string;
  patient_id: string;
  source_type: "membership" | "makeup_reservation" | "ad_hoc_admission";
  source_id: string | null;
  status: "active" | "cancelled";
  patient?: { id: string; name: string; active?: boolean; deleted_at?: string | null } | null;
};

export type EffectiveOccurrenceParticipant = {
  id: string;
  patient: { id: string; name: string; active: boolean };
  source: "MEMBERSHIP" | "MANUAL" | "MAKEUP";
  membershipId: string | null;
  isOverride: boolean;
  effectiveWeekdays: string[];
  attendanceStatus: null;
};

const weekdayForDate = (date: string) => ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][new Date(`${date}T12:00:00Z`).getUTCDay()];

export function effectiveOccurrenceRoster(
  localDate: string,
  scheduleWeekdays: string[],
  memberships: RosterMembership[],
  participants: PersistedOccurrenceParticipant[],
): EffectiveOccurrenceParticipant[] {
  const weekday = weekdayForDate(localDate);
  const byPatient = new Map<string, EffectiveOccurrenceParticipant>();
  const cancelled = new Set(participants.filter((entry) => entry.status === "cancelled").map((entry) => entry.patient_id));

  for (const membership of memberships) {
    const patient = membership.patient;
    const weekdays = membership.weekdays ?? scheduleWeekdays;
    if (membership.effective_from > localDate || (membership.effective_to && localDate >= membership.effective_to)
      || !weekdays.includes(weekday) || !patient || patient.deleted_at || cancelled.has(membership.patient_id)) continue;
    byPatient.set(membership.patient_id, {
      id: `membership:${membership.id}`,
      patient: { id: patient.id, name: patient.name, active: patient.active !== false },
      source: "MEMBERSHIP", membershipId: membership.id, isOverride: false,
      effectiveWeekdays: weekdays, attendanceStatus: null,
    });
  }

  for (const participant of participants) {
    const patient = participant.patient;
    if (participant.status !== "active" || !patient || patient.deleted_at || byPatient.has(participant.patient_id)) continue;
    byPatient.set(participant.patient_id, {
      id: participant.id,
      patient: { id: patient.id, name: patient.name, active: patient.active !== false },
      source: participant.source_type === "makeup_reservation" ? "MAKEUP" : participant.source_type === "ad_hoc_admission" ? "MANUAL" : "MEMBERSHIP",
      membershipId: participant.source_type === "membership" ? participant.source_id : null,
      isOverride: participant.source_type !== "membership", effectiveWeekdays: [], attendanceStatus: null,
    });
  }
  return [...byPatient.values()].sort((first, second) => first.patient.name.localeCompare(second.patient.name, "pt-BR"));
}
