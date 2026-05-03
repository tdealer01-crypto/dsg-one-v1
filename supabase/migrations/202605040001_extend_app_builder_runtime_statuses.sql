-- Extend DSG App Builder status claim vocabulary for governed action runtime.
-- This migration intentionally does not mark jobs as deployable or production-ready.

alter table if exists dsg_app_builder_jobs
  drop constraint if exists dsg_app_builder_jobs_status_check;

alter table if exists dsg_app_builder_jobs
  add constraint dsg_app_builder_jobs_status_check
  check (status in (
    'DRAFT',
    'GOAL_LOCKED',
    'PRD_READY',
    'PLAN_READY',
    'WAITING_APPROVAL',
    'APPROVED',
    'READY_FOR_RUNTIME',
    'EXECUTING',
    'PR_CREATED',
    'REJECTED',
    'BLOCKED',
    'FAILED',
    'COMPLETED'
  ));

alter table if exists dsg_app_builder_jobs
  drop constraint if exists dsg_app_builder_jobs_claim_status_check;

alter table if exists dsg_app_builder_jobs
  add constraint dsg_app_builder_jobs_claim_status_check
  check (claim_status in (
    'NOT_STARTED',
    'PLANNED_ONLY',
    'APPROVED_ONLY',
    'IMPLEMENTED_UNVERIFIED',
    'PREVIEW_READY',
    'DEPLOYABLE',
    'PRODUCTION_BLOCKED',
    'PRODUCTION_VERIFIED'
  ));
