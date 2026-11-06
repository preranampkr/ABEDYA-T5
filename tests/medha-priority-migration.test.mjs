import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(
  new URL('../supabase/migrations/20261105000200_medha_priority_authority.sql', import.meta.url),
  'utf8',
)

function functionBody(name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = migration.match(new RegExp(`create (?:or replace )?function public\\.${escapedName}\\([\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`, 'i'))
  assert.ok(match, `Expected function ${name} to be defined`)
  return match[1]
}

test('analysis refresh accepts report IDs and computes its assessment from source records', () => {
  const calculation = functionBody('medha_calculate_priority')
  const refresh = functionBody('refresh_medha_analyses')
  assert.match(calculation, /from public\.sanket_reports/i)
  assert.match(calculation, /origin_kind = 'user_submission'/i)
  assert.match(migration, /function public\.refresh_medha_analyses\(p_report_ids text\[\]\)/i)
  assert.match(refresh, /medha_calculate_priority\(report_id\)/i)
  assert.doesNotMatch(refresh, /p_analyses|p_priority|p_score|p_confidence/i)
  assert.doesNotMatch(refresh, /medha_priority_overrides/i)
})

test('frontend RPC calls send only report IDs and human-selected override inputs', async () => {
  const repository = await readFile(
    new URL('../src/features/medha/data/repository.ts', import.meta.url),
    'utf8',
  )
  assert.match(repository, /rpc\('refresh_medha_analyses',\s*\{\s*p_report_ids:\s*incidents\.map\(\(\{ reportId \}\) => reportId\)/s)
  assert.match(repository, /rpc\('record_medha_priority_override',\s*\{\s*p_report_id:\s*reportId,\s*p_override_priority:\s*priority,\s*p_reason:\s*reason\.trim\(\)/s)
  assert.doesNotMatch(repository, /p_suggested_priority|p_suggested_score|p_confidence/)
})

test('legacy client-controlled priority RPCs are no longer executable by client roles', () => {
  assert.match(migration, /revoke all on function public\.save_medha_analyses\(jsonb\) from public, anon, authenticated/i)
  assert.match(migration, /revoke all on function public\.override_medha_priority\([\s\S]*?\) from public, anon, authenticated/i)
  assert.match(migration, /grant execute on function public\.refresh_medha_analyses\(text\[\]\) to authenticated/i)
  assert.match(migration, /grant execute on function public\.record_medha_priority_override\(text, text, text\) to authenticated/i)
  assert.match(migration, /revoke all on public\.medha_incident_analysis, public\.medha_priority_assessments\s+from public, anon, authenticated/i)
})

test('override RPC authenticates, validates a mandatory reason, and records the before and after values', () => {
  const override = functionBody('record_medha_priority_override')
  assert.match(override, /has_active_role\('helper'\).*has_active_role\('admin'\)/s)
  assert.match(override, /p_override_priority not in \('critical', 'high', 'medium', 'low'\)/i)
  assert.match(override, /length\(pg_catalog\.btrim\(p_reason\)\) < 10/i)
  assert.match(override, /previous_priority, override_priority, reason, reviewer_id/i)
  assert.match(override, /auth\.uid\(\), reviewer_label, override_at/i)
  assert.match(override, /'previous_priority', previous_priority,[\s\S]*?'new_priority', p_override_priority/i)
  assert.match(override, /insert into public\.medha_review_history/i)
  assert.match(override, /insert into public\.audit_records/i)
})

test('automated recalculation has no write path to the append-only override log', () => {
  const refresh = functionBody('refresh_medha_analyses')
  const override = functionBody('record_medha_priority_override')
  assert.doesNotMatch(refresh, /insert into public\.medha_priority_overrides/i)
  assert.match(override, /insert into public\.medha_priority_overrides/i)
  assert.match(migration, /on conflict \(report_id\) do update/i)
})

test('SENA handoff recomputes priority, requires verified source reports, and includes review provenance', () => {
  const handoff = functionBody('get_medha_sena_handoff')
  assert.match(handoff, /report\.origin_kind = 'user_submission'/i)
  assert.match(handoff, /report\.verification_status = 'verified'/i)
  assert.match(handoff, /medha_calculate_priority\(report\.id\)/i)
  assert.match(handoff, /coalesce\(override\.override_priority, assessment\.value ->> 'priority'\)/i)
  assert.match(handoff, /'priorityProvenance'/i)
  assert.match(handoff, /'reviewerId', override\.reviewer_id/i)
  assert.match(handoff, /'reason', override\.reason/i)
  assert.match(handoff, /'changedAt', override\.created_at/i)
})
