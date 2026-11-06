# Staging database validation

This guide prepares a **separate, non-production Supabase project** for manual validation. The repository does not contain project credentials, and the CLI has not been linked to any remote project. Do not use production for these steps.

## Repository setup

`supabase/config.toml` identifies the local CLI project as `abhedya`; it is not a Supabase project ref. The database migration directory is `supabase/migrations/`, ordered by each filename's timestamp:

1. `20261101000100_abhedya_auth_sanket.sql`
2. `20261101000200_abhedya_security_remediation.sql`
3. `20261105000100_medha_incident_intelligence.sql`
4. `20261105000200_medha_priority_authority.sql`

Install the Supabase CLI locally if needed, from the repository root:

```sh
npm install --save-dev supabase
npx supabase --version
```

The install changes `package.json` and `package-lock.json`; review those changes before committing. Alternatively, install the CLI using the official instructions for your operating system and verify it with `supabase --version`.

## Create and link staging

1. In the Supabase Dashboard, create a **new staging project**. Give it an unmistakable staging name and use test-only accounts and data. Do not select or reuse the production project.
2. Record the staging **project ref** from its Dashboard URL/settings. Confirm the ref and project name before linking.
3. From this repository root, authenticate the CLI and link only the confirmed staging ref:

   ```sh
   npx supabase login
   npx supabase link --project-ref <STAGING_PROJECT_REF>
   ```

   If a later CLI command prompts for the staging database password, enter it only at the interactive prompt. Do not pass it as a command argument, commit it, or paste it into application environment variables. If the CLI prompts to pull remote schema/configuration, stop and inspect before accepting.
4. Before any database command, verify the Dashboard project name/ref again and review the linked migration state below. Linking and the inspection commands contact Supabase; perform them only after confirming the target is staging.

## Application environment variables

The Vite application uses only public client configuration:

```sh
cp .env.example .env.local
```

Set `VITE_SUPABASE_URL` to the staging project's API URL and `VITE_SUPABASE_ANON_KEY` to its anon/publishable key. `VITE_SUPABASE_PUBLISHABLE_KEY` is also supported by the app. Never use a service-role key in any `VITE_*` variable; Vite embeds those values in browser assets. Keep `.env.local` untracked.

The repository ignores `.env`, `.env.*` (except the committed `.env.example` template), and Supabase CLI temporary state. Verify before committing:

```sh
git check-ignore -v .env .env.local .env.staging supabase/.env
git status --short --ignored
```

All real credentials must remain in a local secret manager or untracked environment file. Do not commit credentials, database URLs, access tokens, or service-role keys.

## Inspect version and migration history

Use the linked CLI to compare local and remote migration versions:

```sh
npx supabase migration list --linked
```

To inspect the PostgreSQL server version without putting a password in shell history, use `psql` with the staging host from the Dashboard. The password is entered at the `-W` prompt:

```sh
read -rp 'Staging database host from Dashboard: ' STAGING_DB_HOST
psql -h "$STAGING_DB_HOST" -p 5432 -U postgres -d postgres -W \
  -X -v ON_ERROR_STOP=1 -c 'select version();'
unset STAGING_DB_HOST
```

`psql -W` prompts for the staging database password without including it in the command. Use the database host shown in the staging Dashboard's connection information; network-restricted projects may require their documented pooler connection details instead. If `psql` is unavailable, the Supabase Dashboard SQL Editor can run `select version();` after confirming the project is staging. Record the PostgreSQL version and the migration list in the validation notes.

Expected migration order is the four filenames above. Do not assume a migration is pending: compare the linked history with the local files first. Stop if versions are missing, unexpected, or out of order; investigate rather than using `migration repair` to make the history appear consistent.

## Apply migrations to staging

The second migration (`20261101000200_abhedya_security_remediation.sql`) deletes rows with `origin_kind = 'demo'`. Therefore, use a disposable staging project and do not load test/demo reports until all migrations are complete. Never apply this migration to production as part of staging validation.

After confirming the project ref, PostgreSQL version, and migration history:

```sh
npx supabase db push --linked --dry-run
```

Review the proposed pending migration list. If it is exactly the expected sequence for the verified staging project, take a staging backup/snapshot and then apply:

```sh
npx supabase db push --linked
npx supabase migration list --linked
```

Do not continue if the dry run includes unexpected migrations or the linked target is uncertain. Capture the CLI output with secrets removed.

### Rollback considerations

There are no down migrations. Each migration uses explicit transaction boundaries, so a failed, uncommitted migration should roll back its own transactional changes; confirm the CLI/database error and migration history before retrying. Do not assume this restores earlier committed migrations.

Once a migration has committed, do not edit migration history or manually reverse schema/data changes. Restore a staging snapshot if necessary, or prepare and review a new forward-fix migration. The security-remediation migration deletes demo-origin rows, so any such rows in staging must be treated as disposable. Never use a production restore, production connection, or destructive repair as a rollback strategy.

## Staging-only account and fixture plan

Use distinct test identities and a test-only email domain/mailbox. Do not use real citizen contact details or evidence.

| Test identity | Provisioning and expected behavior |
|---|---|
| Citizen | Sign up through the application with the normal citizen flow. Can submit a report; cannot review, override priority, or read the operational SENA handoff. |
| Active helper | Submit a helper request and have a staging admin approve it through the existing admin workflow. Can perform authorized MEDHA review actions and access the handoff. |
| Inactive helper | Use a staging-only account with helper role and suspended account status, provisioned through an authorized administrative process. Must be denied MEDHA review, override, and handoff operations. |
| Admin | Provision through the trusted administrator/bootstrap process available for the staging project. Must be able to review/override and access the handoff. Never grant admin role from the browser or expose service-role credentials to the app. |

If staging has no safe trusted admin bootstrap path, stop and resolve that before testing; do not promote an account by changing the profile from the client or by an improvised production procedure.

After migrations are complete, create only staging fixtures covering:

- A verified user-submitted incident; an unverified user-submitted incident; and a demo-origin incident.
- Reports spanning incident types/statuses and relevant priority factors, with explicit counts only where the test report supplies them.
- Two similar nearby test reports and two dissimilar/distant reports for duplicate review.
- At least one report without a priority override and one report with a reviewer override.

Keep fixture IDs, user IDs, test emails, and data in staging-only notes. Do not reuse real incident evidence. In particular, do not create demo-origin fixtures before migration `20261101000200` has run.

## MEDHA security and SENA handoff tests

Record each result with the test account/role, RPC or UI action, expected result, actual result, and timestamp. Run each permission test as a separately authenticated staging user.

1. **Report visibility and preservation:** Confirm MEDHA reads the original SANKET report IDs and data; analysis does not create duplicate incident records.
2. **Access control:** As citizen, inactive helper, and unauthenticated user, attempt review, analysis refresh, priority override, and SENA handoff. Each forbidden operation must fail and must not create partial audit or assessment changes. Repeat authorized actions as active helper and admin.
3. **Authoritative priority:** Call `refresh_medha_analyses` with report IDs only. Attempt to submit a fabricated client priority/score payload to the legacy `save_medha_analyses` RPC; it must not be executable by client roles. Confirm the stored assessment is derived from persisted source report fields.
4. **Human override and audit:** Attempt an invalid priority, an empty/too-short reason, and an override as unauthorized/inactive identities; each must fail. As an active reviewer, make an allowed override and verify previous value, new value, reviewer identity, server timestamp, and reason in the audit history. Repeat an override and verify both review events remain recorded.
5. **Override preservation:** Refresh automated assessments after a valid human override. Confirm routine refresh does not silently replace the override, and that handoff reports its reviewer provenance.
6. **Verification workflow:** Verify and reject reports through the authorized review workflow. Confirm changes preserve the original report and record reviewer/action history.
7. **SENA handoff:** As an authorized helper/admin, inspect the handoff. It must include only verified `user_submission` reports, exclude demo and unverified reports, and use the authoritative current priority with override provenance where applicable. Verify that citizen/inactive/unauthenticated requests are denied.
8. **Failure/rollback:** Cause a controlled validation failure with staging-only test inputs. Confirm the operation reports failure and leaves no partial assessment, override, review history, or audit rows. Do not use destructive SQL to simulate failure.

These are test cases, not completed results. Record live outcomes only after running them against the confirmed staging project. The static source tests in `tests/medha-priority-migration.test.mjs` do not validate PostgreSQL execution, RLS, authenticated-role behavior, or deployed SENA output.
