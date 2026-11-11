import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import healthHandler from '../api/health.ts'
import senaHandler from '../api/sena/index.ts'
import punarjeevHandler from '../api/punarjeev/index.ts'
import { senaStore } from '../src/features/sena/data/senaStore.ts'
import { punarjeevRepository } from '../src/features/punarjeev/data/repository.ts'

function createMockReq(method, url = '/', headers = {}) {
  const req = new EventEmitter()
  req.method = method
  req.url = url
  req.headers = { host: 'abhedya.vercel.app', ...headers }
  return req
}

function createMockRes() {
  const headers = new Map()
  let rawBody = ''
  return {
    statusCode: 200,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value)
    },
    getHeader(name) {
      return headers.get(name.toLowerCase())
    },
    end(chunk) {
      if (chunk) rawBody += String(chunk)
    },
    json() {
      return JSON.parse(rawBody || '{}')
    },
  }
}

test('vercel.json preserves /api routes while rewriting client SPA paths to index.html', async () => {
  const raw = await readFile(new URL('../vercel.json', import.meta.url), 'utf8')
  const config = JSON.parse(raw)
  assert.equal(config.framework, 'vite')
  assert.equal(config.outputDirectory, 'dist')
  const spaRewrite = config.rewrites.find((r) => r.destination === '/index.html')
  assert.ok(spaRewrite, 'Expected SPA rewrite rule to /index.html')
  assert.match(spaRewrite.source, /\?!api\//, 'SPA rewrite must exclude /api/ routes')
})

test('SENA and PUNARJEEV backend migration defines RLS-protected tables and infrastructure seeds without PII', async () => {
  const sql = await readFile(
    new URL('../supabase/migrations/20261112000100_sena_punarjeev_backend.sql', import.meta.url),
    'utf8',
  )
  for (const table of [
    'sena_response_units',
    'sena_dispatch_orders',
    'punarjeev_relief_camps',
    'punarjeev_supplies',
    'punarjeev_safe_checkins',
    'punarjeev_rehab_requests',
  ]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, 'i'))
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
  }
  assert.doesNotMatch(sql, /insert into public\.punarjeev_safe_checkins/i)
  assert.doesNotMatch(sql, /insert into public\.sanket_reports/i)
})

test('api/health rejects non-GET methods and reports unconfigured DB safely without crashing', async () => {
  const badReq = createMockReq('POST', '/api/health')
  const badRes = createMockRes()
  await healthHandler(badReq, badRes)
  assert.equal(badRes.statusCode, 405)

  const req = createMockReq('GET', '/api/health')
  const res = createMockRes()
  await healthHandler(req, res)
  assert.equal(res.statusCode, 200)
  const payload = res.json()
  assert.equal(payload.service, 'abhedya-vercel-backend')
  assert.equal(typeof payload.database.connected, 'boolean')
})

test('protected /api/sena and /api/punarjeev endpoints reject unauthenticated or unconfigured requests', async () => {
  const senaReq = createMockReq('GET', '/api/sena')
  const senaRes = createMockRes()
  await senaHandler(senaReq, senaRes)
  assert.ok([401, 503].includes(senaRes.statusCode))

  const punReq = createMockReq('GET', '/api/punarjeev')
  const punRes = createMockRes()
  await punarjeevHandler(punReq, punRes)
  assert.ok([401, 503].includes(punRes.statusCode))
})

test('frontend repositories wire Vercel backend endpoints and fall back cleanly in offline mode', async () => {
  const senaRepoSource = await readFile(new URL('../src/features/sena/data/repository.ts', import.meta.url), 'utf8')
  assert.match(senaRepoSource, /'\/api\/sena'/)
  const units = senaStore.getUnits()
  assert.ok(units.length > 0, 'Expected standby preview units')
  const camps = await punarjeevRepository.getCamps()
  assert.ok(camps.length > 0, 'Expected preview relief camps')
})
