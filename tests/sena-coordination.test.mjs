import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultResponseUnits, getUnitMatchScore, matchNeedToCapability } from '../src/features/sena/data/responseUnits.ts'
import { senaStore } from '../src/features/sena/data/senaStore.ts'

test('maps citizen assistance needs to response capabilities', () => {
  assert.equal(matchNeedToCapability('rescue'), 'water_rescue')
  assert.equal(matchNeedToCapability('medical'), 'medical_triage')
  assert.equal(matchNeedToCapability('evacuation'), 'evacuation')
  assert.equal(matchNeedToCapability('food_water'), 'supply_distribution')
})

test('calculates unit capability match score based on incident needs and availability', () => {
  const ndrf = defaultResponseUnits.find((u) => u.id === 'UNIT-NDRF-01')
  assert.ok(ndrf, 'Expected NDRF unit to exist')

  const waterRescueNeeds = ['rescue', 'evacuation']
  const scoreResult = getUnitMatchScore(ndrf, waterRescueNeeds)

  assert.ok(scoreResult.score >= 6, 'Available matching unit should have high score')
  assert.ok(scoreResult.matchedCapabilities.includes('water_rescue'))
  assert.ok(scoreResult.matchedCapabilities.includes('evacuation'))
})

test('dispatching a unit transitions its status to deployed and creates a dispatch order', () => {
  const initialUnits = senaStore.getUnits()
  const availableUnit = initialUnits.find((u) => u.status === 'available')
  assert.ok(availableUnit, 'Expected an available unit')

  const incidentId = 'TEST-INCIDENT-001'
  const order = senaStore.dispatchTeam({
    incidentId,
    unitId: availableUnit.id,
    priority: 'critical',
    missionBrief: 'Deploy inflatable boats to flood zone',
    assignedBy: 'Commander Test',
  })

  assert.equal(order.incidentId, incidentId)
  assert.equal(order.unitId, availableUnit.id)
  assert.equal(order.status, 'dispatched')
  assert.equal(order.fieldLogs.length, 1)

  const updatedUnit = senaStore.getUnit(availableUnit.id)
  assert.equal(updatedUnit?.status, 'deployed')
  assert.equal(updatedUnit?.assignedIncidentId, incidentId)
})

test('progressing dispatch stage appends logs and resolving frees the assigned response unit', () => {
  const incidentId = 'TEST-INCIDENT-002'
  const unit = senaStore.getUnits().find((u) => u.status === 'available')
  assert.ok(unit)

  senaStore.dispatchTeam({
    incidentId,
    unitId: unit.id,
    priority: 'high',
    missionBrief: 'Clear blocked road',
    assignedBy: 'Lead Coordinator',
  })

  // Transition to on_scene
  const onSceneOrder = senaStore.updateDispatchStage({
    incidentId,
    status: 'on_scene',
    updatedBy: 'Team Leader',
    note: 'Arrived at location, clearing fallen trees',
  })
  assert.equal(onSceneOrder.status, 'on_scene')
  assert.equal(onSceneOrder.fieldLogs.length, 2)

  // Append mid-operation field log
  const log = senaStore.appendFieldLog(incidentId, 'Main lane cleared for ambulances', 'Field Tech')
  assert.ok(log.id)
  assert.equal(log.text, 'Main lane cleared for ambulances')

  // Resolve mission
  const resolvedOrder = senaStore.updateDispatchStage({
    incidentId,
    status: 'resolved',
    updatedBy: 'Lead Coordinator',
    note: 'Road fully reopened, operation concluded',
    outcome: { rescuedCount: 0, assistedCount: 45, notes: 'Road restored' },
  })
  assert.equal(resolvedOrder.status, 'resolved')
  assert.ok(resolvedOrder.outcome)
  assert.equal(resolvedOrder.outcome.assistedCount, 45)

  // Check unit freed
  const freedUnit = senaStore.getUnit(unit.id)
  assert.equal(freedUnit?.status, 'available')
  assert.equal(freedUnit?.assignedIncidentId, null)
})

test('handoff conversion maps priority provenance and verified report fields', () => {
  const fakeHandoff = {
    report: {
      id: 'SNK-TEST-99',
      reportType: 'sos',
      category: 'flooding',
      urgency: 'critical',
      createdAt: '2026-11-07T10:00:00Z',
      updatedAt: '2026-11-07T10:00:00Z',
      location: {
        label: 'Near River Bridge',
        locality: 'Kundapura',
        taluk: 'Kundapura',
        district: 'Udupi',
        latitude: 13.63,
        longitude: 74.70,
        source: 'manual',
      },
      reporter: {
        name: 'Citizen A',
        phone: '+91 99999 11111',
        contactPreference: 'phone',
      },
      reportedImpacts: {
        peopleAffected: 4,
        reportedInjuries: 1,
        vulnerablePeople: 2,
        peopleTrapped: 3,
      },
      assistanceNeeds: ['rescue', 'medical'],
      summary: 'Water level reaching second floor',
      details: 'Stranded family need boat evacuation',
      status: 'under_review',
      originKind: 'user_submission',
      verificationStatus: 'verified',
    },
    statusHistory: [],
    priority: 'critical',
    priorityProvenance: {
      source: 'reviewer_override',
      priority: 'critical',
      previousPriority: 'high',
      reviewerId: 'rev-01',
      reviewerName: 'Helper Officer',
      reason: 'Aerial confirmation of rapid inundation',
      changedAt: '2026-11-07T10:15:00Z',
      algorithmVersion: 'medha-rules-v1',
      assessedAt: '2026-11-07T10:05:00Z',
    },
  }

  const senaItem = senaStore.convertHandoffToItem(fakeHandoff)
  assert.equal(senaItem.id, 'SNK-TEST-99')
  assert.equal(senaItem.priority, 'critical')
  assert.equal(senaItem.prioritySource, 'reviewer_override')
  assert.equal(senaItem.priorityReason, 'Aerial confirmation of rapid inundation')
  assert.equal(senaItem.reportedImpacts.peopleTrapped, 3)
  assert.deepEqual(senaItem.assistanceNeeds, ['rescue', 'medical'])
})
