import type { IncomingMessage, ServerResponse } from 'node:http'
import { authenticateRequest, getQueryUrl, methodNotAllowed, readJsonBody, sendJson } from '../_lib/server.ts'

interface DbCampRow {
  id: string
  name: string
  taluk: string
  address: string
  location: Record<string, unknown>
  manager_name: string
  manager_phone: string
  capacity: number
  current_occupancy: number
  status: 'open' | 'near_capacity' | 'full' | 'closed'
  facilities: string[]
  urgently_needed: string[]
  last_updated: string
}

interface DbSupplyRow {
  id: string
  camp_id: string
  camp_name: string
  category: string
  item_name: string
  quantity: number
  unit: string
  status: 'sufficient' | 'low' | 'critical'
  last_restocked: string
}

interface DbCheckinRow {
  id: string
  full_name: string
  age: number | null
  gender: 'male' | 'female' | 'other' | null
  home_locality: string
  camp_id: string
  camp_name: string
  contact_phone: string
  family_members_count: number
  checked_in_at: string
  status: 'safe_in_camp' | 'reunited' | 'departed'
}

interface DbRehabRow {
  id: string
  claimant_name: string
  claimant_phone: string
  claimant_aadhaar_last4: string | null
  taluk: string
  locality: string
  claim_type: string
  estimated_loss_inr: number | null
  description: string
  status: string
  approval_notes: string | null
  created_at: string
  updated_at: string
}

function mapCamp(row: DbCampRow) {
  return {
    id: row.id,
    name: row.name,
    taluk: row.taluk,
    address: row.address,
    location: row.location,
    managerName: row.manager_name,
    managerPhone: row.manager_phone,
    capacity: row.capacity,
    currentOccupancy: row.current_occupancy,
    status: row.status,
    facilities: row.facilities ?? [],
    urgentlyNeeded: row.urgently_needed ?? [],
    lastUpdated: row.last_updated,
  }
}

function mapSupply(row: DbSupplyRow) {
  return {
    id: row.id,
    campId: row.camp_id,
    campName: row.camp_name,
    category: row.category,
    itemName: row.item_name,
    quantity: row.quantity,
    unit: row.unit,
    status: row.status,
    lastRestocked: row.last_restocked,
  }
}

function mapCheckin(row: DbCheckinRow) {
  return {
    id: row.id,
    fullName: row.full_name,
    age: row.age ?? undefined,
    gender: row.gender ?? undefined,
    homeLocality: row.home_locality,
    campId: row.camp_id,
    campName: row.camp_name,
    contactPhone: row.contact_phone,
    familyMembersCount: row.family_members_count,
    checkedInAt: row.checked_in_at,
    status: row.status,
  }
}

function mapRehab(row: DbRehabRow) {
  return {
    id: row.id,
    claimantName: row.claimant_name,
    claimantPhone: row.claimant_phone,
    claimantAadhaarLast4: row.claimant_aadhaar_last4 ?? undefined,
    taluk: row.taluk,
    locality: row.locality,
    claimType: row.claim_type,
    estimatedLossInr: row.estimated_loss_inr === null ? undefined : Number(row.estimated_loss_inr),
    description: row.description,
    status: row.status,
    approvalNotes: row.approval_notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function computeCampStatus(occupancy: number, capacity: number): 'open' | 'near_capacity' | 'full' {
  const ratio = capacity > 0 ? occupancy / capacity : 1
  if (ratio >= 1.0) return 'full'
  if (ratio >= 0.85) return 'near_capacity'
  return 'open'
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!['GET', 'POST', 'PATCH'].includes(req.method || '')) {
    methodNotAllowed(res, ['GET', 'POST', 'PATCH'])
    return
  }

  const auth = await authenticateRequest(req, res, ['victim', 'helper', 'admin'])
  if (!auth) return

  const isPrivileged = auth.role === 'helper' || auth.role === 'admin'

  try {
    if (req.method === 'GET') {
      const url = getQueryUrl(req)
      const q = (url.searchParams.get('q') || '').trim().toLowerCase()

      const [campsRes, suppliesRes, checkinsRes, rehabsRes] = await Promise.all([
        auth.db.from('punarjeev_relief_camps').select('*').order('id', { ascending: true }),
        isPrivileged
          ? auth.db.from('punarjeev_supplies').select('*').order('last_restocked', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        auth.db.from('punarjeev_safe_checkins').select('*').order('checked_in_at', { ascending: false }),
        auth.db.from('punarjeev_rehab_requests').select('*').order('created_at', { ascending: false }),
      ])

      if (campsRes.error) throw campsRes.error
      if (suppliesRes.error) throw suppliesRes.error
      if (checkinsRes.error) throw checkinsRes.error
      if (rehabsRes.error) throw rehabsRes.error

      const checkins = (checkinsRes.data as DbCheckinRow[]).map(mapCheckin).filter((item) => {
        if (!q) return true
        return (
          item.fullName.toLowerCase().includes(q) ||
          item.contactPhone.replace(/\s+/g, '').includes(q.replace(/\s+/g, '')) ||
          item.homeLocality.toLowerCase().includes(q) ||
          item.campName.toLowerCase().includes(q)
        )
      })

      sendJson(res, 200, {
        camps: (campsRes.data as DbCampRow[]).map(mapCamp),
        supplies: (suppliesRes.data as DbSupplyRow[]).map(mapSupply),
        checkins,
        rehabs: (rehabsRes.data as DbRehabRow[]).map(mapRehab),
      })
      return
    }

    const body = await readJsonBody<Record<string, unknown>>(req)
    const kind = typeof body.kind === 'string' ? body.kind : ''

    if (req.method === 'POST') {
      if (kind === 'checkin') {
        const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
        const homeLocality = typeof body.homeLocality === 'string' ? body.homeLocality.trim() : ''
        const campId = typeof body.campId === 'string' ? body.campId.trim() : ''
        const contactPhone = typeof body.contactPhone === 'string' ? body.contactPhone.trim() : ''
        const familyMembersCount = Math.max(1, Number(body.familyMembersCount) || 1)

        if (!fullName || !homeLocality || !campId || !contactPhone) {
          sendJson(res, 400, { error: 'fullName, homeLocality, campId, and contactPhone are required.' })
          return
        }

        const { data: campRow, error: campErr } = await auth.db
          .from('punarjeev_relief_camps')
          .select('id, name, capacity, current_occupancy')
          .eq('id', campId)
          .maybeSingle()

        if (campErr || !campRow) {
          sendJson(res, 404, { error: `Relief camp ${campId} not found.` })
          return
        }

        const now = new Date().toISOString()
        const id = `CHK-${Math.floor(1000 + Math.random() * 9000)}`
        const { data: inserted, error: insErr } = await auth.db
          .from('punarjeev_safe_checkins')
          .insert({
            id,
            full_name: fullName,
            age: typeof body.age === 'number' ? body.age : null,
            gender: typeof body.gender === 'string' ? body.gender : null,
            home_locality: homeLocality,
            camp_id: campRow.id,
            camp_name: campRow.name,
            contact_phone: contactPhone,
            family_members_count: familyMembersCount,
            checked_in_at: now,
            status: 'safe_in_camp',
            submitted_by: auth.userId,
          })
          .select()
          .single()

        if (insErr) throw insErr

        const nextOcc = Number(campRow.current_occupancy) + familyMembersCount
        const nextStatus = computeCampStatus(nextOcc, Number(campRow.capacity))
        await auth.adminDb
          .from('punarjeev_relief_camps')
          .update({ current_occupancy: nextOcc, status: nextStatus, last_updated: now })
          .eq('id', campRow.id)

        sendJson(res, 201, { checkin: mapCheckin(inserted as DbCheckinRow) })
        return
      }

      if (kind === 'supply_request') {
        if (!isPrivileged) {
          sendJson(res, 403, { error: 'Only authorized helpers can request relief supplies.' })
          return
        }
        const campId = typeof body.campId === 'string' ? body.campId.trim() : ''
        const category = typeof body.category === 'string' ? body.category.trim() : 'food_water'
        const itemName = typeof body.itemName === 'string' ? body.itemName.trim() : ''
        const quantity = Math.max(1, Number(body.quantity) || 1)
        const unit = typeof body.unit === 'string' ? body.unit.trim() : 'Units'

        if (!campId || !itemName) {
          sendJson(res, 400, { error: 'campId and itemName are required.' })
          return
        }

        const { data: campRow, error: campErr } = await auth.db
          .from('punarjeev_relief_camps')
          .select('id, name')
          .eq('id', campId)
          .maybeSingle()

        if (campErr || !campRow) {
          sendJson(res, 404, { error: `Relief camp ${campId} not found.` })
          return
        }

        const id = `SUP-${Math.floor(100 + Math.random() * 900)}`
        const { data: inserted, error: insErr } = await auth.db
          .from('punarjeev_supplies')
          .insert({
            id,
            camp_id: campRow.id,
            camp_name: campRow.name,
            category,
            item_name: itemName,
            quantity,
            unit,
            status: 'critical',
            requested_by: auth.userId,
            last_restocked: new Date().toISOString(),
          })
          .select()
          .single()

        if (insErr) throw insErr
        sendJson(res, 201, { supply: mapSupply(inserted as DbSupplyRow) })
        return
      }

      if (kind === 'rehab_claim') {
        const claimantName = typeof body.claimantName === 'string' ? body.claimantName.trim() : ''
        const claimantPhone = typeof body.claimantPhone === 'string' ? body.claimantPhone.trim() : ''
        const taluk = typeof body.taluk === 'string' ? body.taluk.trim() : 'Udupi'
        const locality = typeof body.locality === 'string' ? body.locality.trim() : ''
        const claimType = typeof body.claimType === 'string' ? body.claimType.trim() : 'house_damage'
        const description = typeof body.description === 'string' ? body.description.trim() : ''

        if (!claimantName || !claimantPhone || !locality || !description) {
          sendJson(res, 400, { error: 'claimantName, claimantPhone, locality, and description are required.' })
          return
        }

        const now = new Date().toISOString()
        const id = `RHB-${Math.floor(100 + Math.random() * 900)}`
        const { data: inserted, error: insErr } = await auth.db
          .from('punarjeev_rehab_requests')
          .insert({
            id,
            owner_id: auth.userId,
            claimant_name: claimantName,
            claimant_phone: claimantPhone,
            claimant_aadhaar_last4:
              typeof body.claimantAadhaarLast4 === 'string' ? body.claimantAadhaarLast4.trim() : null,
            taluk,
            locality,
            claim_type: claimType,
            estimated_loss_inr: typeof body.estimatedLossInr === 'number' ? body.estimatedLossInr : null,
            description,
            status: 'submitted',
            created_at: now,
            updated_at: now,
          })
          .select()
          .single()

        if (insErr) throw insErr
        sendJson(res, 201, { request: mapRehab(inserted as DbRehabRow) })
        return
      }

      sendJson(res, 400, { error: 'Unknown POST kind. Expected checkin, supply_request, or rehab_claim.' })
      return
    }

    // PATCH requires helper/admin role
    if (!isPrivileged) {
      sendJson(res, 403, { error: 'Only authorized helpers or admins can modify shelter or claim state.' })
      return
    }

    if (kind === 'camp_occupancy') {
      const campId = typeof body.campId === 'string' ? body.campId.trim() : ''
      const occupancy = Math.max(0, Number(body.occupancy) || 0)
      if (!campId) {
        sendJson(res, 400, { error: 'campId is required.' })
        return
      }

      const { data: campRow, error: campErr } = await auth.db
        .from('punarjeev_relief_camps')
        .select('id, capacity')
        .eq('id', campId)
        .maybeSingle()

      if (campErr || !campRow) {
        sendJson(res, 404, { error: `Relief camp ${campId} not found.` })
        return
      }

      const nextStatus = computeCampStatus(occupancy, Number(campRow.capacity))
      const { data: updated, error: updErr } = await auth.db
        .from('punarjeev_relief_camps')
        .update({
          current_occupancy: occupancy,
          status: nextStatus,
          last_updated: new Date().toISOString(),
        })
        .eq('id', campId)
        .select()
        .single()

      if (updErr) throw updErr
      sendJson(res, 200, { camp: mapCamp(updated as DbCampRow) })
      return
    }

    if (kind === 'rehab_status') {
      const id = typeof body.id === 'string' ? body.id.trim() : ''
      const status = typeof body.status === 'string' ? body.status.trim() : ''
      const notes = typeof body.notes === 'string' ? body.notes.trim() : ''
      if (!id || !status) {
        sendJson(res, 400, { error: 'id and status are required.' })
        return
      }

      const { data: updated, error: updErr } = await auth.db
        .from('punarjeev_rehab_requests')
        .update({
          status,
          approval_notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (updErr) throw updErr
      sendJson(res, 200, { request: mapRehab(updated as DbRehabRow) })
      return
    }

    sendJson(res, 400, { error: 'Unknown PATCH kind. Expected camp_occupancy or rehab_status.' })
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'PUNARJEEV backend operation failed.',
    })
  }
}
