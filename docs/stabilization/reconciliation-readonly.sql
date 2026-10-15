begin transaction read only;
with day as(select (now() at time zone 'America/Sao_Paulo')::date as today), missing as(
 select m.*,c.id as class_id from public.group_slot_memberships m join public.classes c on c.clinic_id=m.clinic_id and c.legacy_source='group_slot' and c.legacy_source_id=m.group_slot_id cross join day d
 where m.status='active' and m.deleted_at is null and (m.ends_at is null or m.ends_at>=d.today)
 and not exists(select 1 from public.class_memberships cm where cm.clinic_id=m.clinic_id and cm.legacy_source='group_slot_membership' and cm.legacy_source_id=m.id)
), stale as(
 select cm.*,m.updated_at as legacy_updated_at,m.deleted_at as legacy_deleted_at,m.status as legacy_status,m.ends_at as legacy_end from public.class_memberships cm join public.group_slot_memberships m on cm.clinic_id=m.clinic_id and cm.legacy_source='group_slot_membership' and cm.legacy_source_id=m.id cross join day d
 where (cm.effective_to is null or cm.effective_to>d.today) and (m.deleted_at is not null or m.status<>'active' or m.ends_at<d.today)
), fingerprint as(
 select md5(string_agg(v,'|' order by v)) as hash from(
 select 'missing:'||id::text||':'||patient_id::text||':'||coalesce(enrollment_id::text,'')||':'||updated_at::text||':'||class_id::text||':'||starts_at::text||':'||coalesce(ends_at::text,'')||':'||weekdays::text as v from missing
 union all select 'stale:'||id::text||':'||patient_id::text||':'||coalesce(enrollment_id::text,'')||':'||legacy_updated_at::text||':'||coalesce(legacy_deleted_at::text,'')||':'||legacy_status||':'||coalesce(legacy_end::text,'') from stale
 )x
)
select jsonb_build_object(
 'missing_count',(select count(*) from missing),'stale_count',(select count(*) from stale),'fingerprint',(select hash from fingerprint),
 'missing_patient_outside_clinic',(select count(*) from missing m where not exists(select 1 from public.patients p where p.id=m.patient_id and p.clinic_id=m.clinic_id)),
 'missing_patient_deleted',(select count(*) from missing m join public.patients p on p.id=m.patient_id and p.clinic_id=m.clinic_id where p.deleted_at is not null),
 'missing_invalid_patient',(select count(*) from missing m where not exists(select 1 from public.patients p where p.id=m.patient_id and p.clinic_id=m.clinic_id and p.deleted_at is null)),
 'missing_invalid_enrollment',(select count(*) from missing m where m.enrollment_id is not null and not exists(select 1 from public.enrollments e where e.id=m.enrollment_id and e.clinic_id=m.clinic_id and e.patient_id=m.patient_id and e.deleted_at is null)),
 'missing_invalid_weekdays',(select count(*) from missing m where cardinality(m.weekdays)=0 or not exists(select 1 from public.class_schedules s cross join day d where s.class_id=m.class_id and s.effective_from<=greatest(m.starts_at,d.today) and (s.effective_to is null or greatest(m.starts_at,d.today)<s.effective_to) and array(select (case w when 0 then 'sunday' when 1 then 'monday' when 2 then 'tuesday' when 3 then 'wednesday' when 4 then 'thursday' when 5 then 'friday' when 6 then 'saturday' end)::public.class_weekday from unnest(m.weekdays) w)<@s.weekdays)),
 'stale_with_future_attendance',(select count(*) from stale cm where exists(select 1 from public.occurrence_participants p join public.class_occurrences o on o.id=p.class_occurrence_id join public.attendances a on a.occurrence_participant_id=p.id cross join day d where p.source_id=cm.id and o.local_date>=d.today)),
 'missing_existing_overlap',(select count(*) from missing m where exists(select 1 from public.class_memberships cm cross join day d where cm.class_id=m.class_id and cm.patient_id=m.patient_id and daterange(cm.effective_from,cm.effective_to,'[)')&&daterange(greatest(m.starts_at,d.today),m.ends_at+1,'[)')))
) as reconciliation;
rollback;
