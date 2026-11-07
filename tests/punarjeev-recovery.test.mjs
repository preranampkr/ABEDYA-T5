import test from 'node:test'
import assert from 'node:assert/strict'
import { punarjeevStore } from '../src/features/punarjeev/data/punarjeevStore.ts'

test('initializes relief camps across Udupi district', () => {
  const camps = punarjeevStore.getCamps()
  assert.ok(camps.length >= 5, 'Should have multiple relief camps seeded')

  const taluks = new Set(camps.map((c) => c.taluk))
  assert.ok(taluks.has('Kundapura'), 'Should have shelters in Kundapura')
  assert.ok(taluks.has('Udupi'), 'Should have shelters in Udupi')
  assert.ok(taluks.has('Byndoor'), 'Should have shelters in Byndoor')

  camps.forEach((camp) => {
    assert.ok(camp.id.startsWith('CAMP-'))
    assert.ok(camp.capacity > 0)
    assert.ok(camp.location.latitude > 13 && camp.location.latitude < 14)
    assert.ok(camp.location.longitude > 74 && camp.location.longitude < 75.5)
  })
})

test('updates camp occupancy and dynamically adjusts capacity threshold status', () => {
  const camp = punarjeevStore.getCamps()[0]
  assert.ok(camp)

  // Under 85% capacity -> open
  punarjeevStore.updateCampOccupancy(camp.id, Math.floor(camp.capacity * 0.5))
  assert.equal(punarjeevStore.getCamp(camp.id)?.status, 'open')

  // >= 85% and < 100% capacity -> near_capacity
  punarjeevStore.updateCampOccupancy(camp.id, Math.floor(camp.capacity * 0.9))
  assert.equal(punarjeevStore.getCamp(camp.id)?.status, 'near_capacity')

  // >= 100% capacity -> full
  punarjeevStore.updateCampOccupancy(camp.id, camp.capacity + 10)
  assert.equal(punarjeevStore.getCamp(camp.id)?.status, 'full')
})

test('searches Bandhu safe check-ins by name, phone, locality, or shelter', () => {
  const allCheckins = punarjeevStore.getSafeCheckins()
  assert.ok(allCheckins.length > 0)

  // Empty query returns all
  const emptyResults = punarjeevStore.searchSafeCheckins('')
  assert.equal(emptyResults.length, allCheckins.length)

  // Search by partial name
  const first = allCheckins[0]
  const byName = punarjeevStore.searchSafeCheckins(first.fullName.slice(0, 4))
  assert.ok(byName.some((c) => c.id === first.id))

  // Search by locality
  const byLoc = punarjeevStore.searchSafeCheckins(first.homeLocality)
  assert.ok(byLoc.some((c) => c.id === first.id))
})

test('registers safe check-in and updates camp occupancy count', () => {
  const camp = punarjeevStore.getCamps()[0]
  const initialOccupancy = camp.currentOccupancy

  const checkin = punarjeevStore.addSafeCheckin({
    fullName: 'Ramesh Sanil',
    age: 48,
    gender: 'male',
    homeLocality: 'Kodi Bengre Fishermen Colony',
    campId: camp.id,
    contactPhone: '+91 94812 00099',
    familyMembersCount: 4,
  })

  assert.ok(checkin.id.startsWith('CHK-'))
  assert.equal(checkin.fullName, 'Ramesh Sanil')
  assert.equal(checkin.status, 'safe_in_camp')

  const updatedCamp = punarjeevStore.getCamp(camp.id)
  assert.equal(updatedCamp?.currentOccupancy, initialOccupancy + 4)
})

test('creates emergency supply requisition with critical status', () => {
  const camps = punarjeevStore.getCamps()
  const camp = camps[0]

  const requisition = punarjeevStore.requestSupply({
    campId: camp.id,
    category: 'medical',
    itemName: 'Antivenom vials & ORS Packets',
    quantity: 50,
    unit: 'Kits',
  })

  assert.ok(requisition.id.startsWith('SUP-'))
  assert.equal(requisition.itemName, 'Antivenom vials & ORS Packets')
  assert.equal(requisition.status, 'critical')
  assert.equal(requisition.campId, camp.id)

  const supplies = punarjeevStore.getSupplies()
  assert.ok(supplies.some((s) => s.id === requisition.id))
})

test('submits and processes post-disaster rehabilitation compensation claim', () => {
  const claim = punarjeevStore.submitRehabRequest({
    claimantName: 'Kamala Mogaveera',
    claimantPhone: '+91 97410 55432',
    claimantAadhaarLast4: '8831',
    taluk: 'Kundapura',
    locality: 'Hemmady Riverside',
    claimType: 'house_damage',
    estimatedLossInr: 120000,
    description: 'Mud brick compound wall collapsed and kitchen flooded with 4ft silt.',
  })

  assert.ok(claim.id.startsWith('RHB-'))
  assert.equal(claim.claimantName, 'Kamala Mogaveera')
  assert.equal(claim.status, 'submitted')
  assert.equal(claim.estimatedLossInr, 120000)

  // Progress status to survey scheduled
  const updatedClaim = punarjeevStore.updateRehabStatus(
    claim.id,
    'survey_scheduled',
    'Revenue Inspector assigned for spot verification on 2026-11-09',
  )
  assert.equal(updatedClaim.status, 'survey_scheduled')
  assert.ok(updatedClaim.approvalNotes?.includes('Revenue Inspector'))

  // Progress status to approved
  const approvedClaim = punarjeevStore.updateRehabStatus(
    claim.id,
    'approved',
    'Sanctioned Rs 95,000 via SDRF Direct Benefit Transfer',
  )
  assert.equal(approvedClaim.status, 'approved')
  assert.ok(approvedClaim.approvalNotes?.includes('SDRF'))
})
