-- Run only AFTER final release authorization, with psql ON_ERROR_STOP.
-- Runs exactly ONE reviewed migration and registers that version atomically.
\set ON_ERROR_STOP on
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
select pg_advisory_xact_lock(hashtextextended('fisiofit-release-202610150008',0));
do $$ begin
 if not exists(select 1 from supabase_migrations.schema_migrations where version='202610140007') then raise exception 'FINANCIAL_BASE_NOT_PUBLISHED';end if;
 if exists(select 1 from supabase_migrations.schema_migrations where version>='202610150008') then raise exception 'MIGRATION_STATE_REVIEW_REQUIRED';end if;
end $$;
\ir ../../supabase/migrations/202610150008_operational_stabilization.sql
insert into supabase_migrations.schema_migrations(version,name)values('202610150008','operational_stabilization');
commit;
