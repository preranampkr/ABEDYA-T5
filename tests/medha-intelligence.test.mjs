import assert from 'node:assert/strict'
import test from 'node:test'
import { sampleReports } from '../src/features/sanket/data/sampleReports.ts'
import { assessPriority, detectDuplicateCandidates } from '../src/features/medha/data/intelligence.ts'

function report(overrides = {}) {
  return {
    ...sampleReports[0],
    id: 'TEST-1',
    reportType: 'incident',
    category: 'flooding',
    urgency: 'low',
    status: 'incoming',
    createdAt: '2026-11-05T10:00:00.000Z',
    updatedAt: '2026-11-05T10:00:00.000Z',
    location: { ...sampleReports[0].location, latitude: undefined, longitude: undefined },
    assistanceNeeds: [],
    summary: 'Water on road',
    details: 'Road affected near the market',
    reportedImpacts: { peopleAffected: null, reportedInjuries: null, vulnerablePeople: null, peopleTrapped: null },
    ...overrides,
  }
}

test('priority leaves unreported impact counts unknown and does not award their risk points', () => {
  const assessment = assessPriority(report(), Date.parse('2026-11-05T11:00:00.000Z'))
  assert.equal(assessment.priority, 'low')
  assert.equal(assessment.unknownFactors.length, 4)
  assert.equal(assessment.confidence, 43)
})

test('explicit injuries and trapped people increase suggested priority with explanations', () => {
  const assessment = assessPriority(report({
    urgency: 'high',
    reportedImpacts: { peopleAffected: 12, reportedInjuries: 2, vulnerablePeople: 1, peopleTrapped: 1 },
  }), Date.parse('2026-11-05T11:00:00.000Z'))
  assert.equal(assessment.priority, 'critical')
  assert.ok(assessment.factors.some((factor) => factor.key === 'injuries'))
  assert.ok(assessment.factors.some((factor) => factor.key === 'trapped'))
  assert.equal(assessment.unknownFactors.length, 0)
})

test('duplicate detection requires corroborating text or precise coordinates', () => {
  const base = report({ id: 'SNK-1001', category: 'flooding', reportType: 'incident' })
  const sameAreaOnly = report({
    id: 'SNK-1002',
    category: 'flooding',
    reportType: 'incident',
    summary: 'Power outage in the school',
    details: 'Several residents report a long outage',
    createdAt: '2026-11-05T11:00:00.000Z',
  })
  const matching = report({
    id: 'SNK-1003',
    category: 'flooding',
    reportType: 'incident',
    summary: 'Water on road near market',
    details: 'Road affected near the market after heavy rain',
    createdAt: '2026-11-05T11:15:00.000Z',
  })
  assert.equal(detectDuplicateCandidates([base, sameAreaOnly]).length, 0)
  const matches = detectDuplicateCandidates([base, matching])
  assert.equal(matches.length, 1)
  assert.deepEqual([matches[0].firstReportId, matches[0].secondReportId], ['SNK-1001', 'SNK-1003'])
  assert.ok(matches[0].reasons.length >= 2)
})

test('duplicate detection does not use unknown or distant coordinates as a location match', () => {
  const first = report({ id: 'SNK-2001' })
  const distant = report({
    id: 'SNK-2002',
    location: { ...sampleReports[0].location, latitude: 10, longitude: 70 },
    createdAt: '2026-11-05T11:00:00.000Z',
    summary: 'Different incident',
    details: 'Nothing similar is described here',
  })
  assert.equal(detectDuplicateCandidates([first, distant]).length, 0)
})

test('duplicate detection never compares demonstration data with operational reports', () => {
  const demo = report({ id: 'DEMO-1', originKind: 'demo' })
  const operational = report({ id: 'SNK-3001', originKind: 'user_submission' })
  assert.equal(detectDuplicateCandidates([demo, operational]).length, 0)
})
