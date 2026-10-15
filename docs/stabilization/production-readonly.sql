begin transaction read only;
select jsonb_build_object(
 'versions_202610', (select jsonb_agg(version order by version) from supabase_migrations.schema_migrations where version>='202610000000'),
 'active_legacy_groups', (select count(*) from public.group_slots where active and deleted_at is null),
 'unmapped_active_legacy_groups', (select count(*) from public.group_slots g where g.active and g.deleted_at is null and not exists(select 1 from public.classes c where c.clinic_id=g.clinic_id and c.legacy_source='group_slot' and c.legacy_source_id=g.id)),
 'active_legacy_memberships', (select count(*) from public.group_slot_memberships m where m.status='active' and m.deleted_at is null and (m.ends_at is null or m.ends_at>=(now() at time zone 'America/Sao_Paulo')::date)),
 'unmapped_active_legacy_memberships', (select count(*) from public.group_slot_memberships m where m.status='active' and m.deleted_at is null and (m.ends_at is null or m.ends_at>=(now() at time zone 'America/Sao_Paulo')::date) and not exists(select 1 from public.class_memberships c where c.clinic_id=m.clinic_id and c.legacy_source='group_slot_membership' and c.legacy_source_id=m.id)),
 'active_class_memberships_with_ended_legacy', (select count(*) from public.class_memberships c join public.group_slot_memberships m on c.legacy_source='group_slot_membership' and c.legacy_source_id=m.id and c.clinic_id=m.clinic_id where (c.effective_to is null or c.effective_to>(now() at time zone 'America/Sao_Paulo')::date) and (m.deleted_at is not null or m.status<>'active' or m.ends_at<(now() at time zone 'America/Sao_Paulo')::date)),
 'invalid_legacy_group_references', (select count(*) from public.group_slots g where g.active and g.deleted_at is null and (not exists(select 1 from public.units u where u.id=g.unit_id and u.clinic_id=g.clinic_id and u.deleted_at is null) or (g.professional_id is not null and not exists(select 1 from public.professionals p where p.id=g.professional_id and p.clinic_id=g.clinic_id and p.deleted_at is null)))),
 'ambiguous_active_professional_profiles', (select count(*) from (select profile_id from public.professionals where active and deleted_at is null and profile_id is not null group by profile_id having count(*)>1) x)
) as metadata;
rollback;
