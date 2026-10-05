# ADR-010 — Arquitetura de calendário para Scheduling e Pilates

**Status:** aprovada para desenho e persistência aditiva.

## Contexto e problema

O legado mistura turma, recorrência e occurrence em `group_slots`, usa `appointments` para bloqueios e usos de turma, e não mantém roster/attendance/correções como fatos históricos.

## Decisão

Calendar é projection read-only. Pilates possui `Class`, `ClassSchedule`, `ClassOccurrence`, membership, participant, attendance e makeup; Scheduling possui Appointment, revision e ScheduleBlock; Staff possui availability/leave; Organization origina holidays/exceptions. Schedules usam vigência semiaberta; occurrences guardam snapshot. Sala e equipamento não são recursos exclusivos. ConflictPolicy valida profissional e paciente por intervalo concreto, globalmente por tenant para profissional.

## Consequências

Há mais tabelas/comandos e materialização idempotente, mas histórico, conflito e capacidade passam a ser corretos. Não há `calendar_events` transacional nem dual write padrão.

## Alternativas consideradas

Manter `group_slots`; transformar occurrences em Appointment; uma tabela universal de eventos; sala como recurso exclusivo; big bang. Todas rejeitadas por mistura de ownership, perda de histórico ou risco de migração.

## Migração e ownership

Aplicar strangler do contrato AGENDA-002 e ADR-009. Backfill só após profiling/reconciliação. Cada comando é autorizado por action+scope+ownership e grava audit redigido; alterações históricas usam versões, estados ou revisões append-only.
