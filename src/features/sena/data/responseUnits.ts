import type { ResponseUnit, SenaCapability } from '../types'
import type { SanketAssistanceNeed } from '../../sanket/types'

export const defaultResponseUnits: ResponseUnit[] = [
  {
    id: 'UNIT-NDRF-01',
    name: 'NDRF 10th Bn - Swift Water Team Alpha',
    agency: 'NDRF',
    callSign: 'Viper-1',
    leader: 'Insp. Ramesh Gowda',
    phone: '+91 94481 12345',
    personnelCount: 18,
    status: 'available',
    capabilities: ['water_rescue', 'evacuation', 'aerial_recon'],
    baseLocation: {
      label: 'Malpe Coastal Rescue Station',
      locality: 'Malpe Port',
      taluk: 'Udupi',
      district: 'Udupi',
      latitude: 13.3512,
      longitude: 74.6978,
      source: 'manual',
    },
    currentLocation: {
      label: 'Malpe Coastal Rescue Station',
      locality: 'Malpe Port',
      taluk: 'Udupi',
      district: 'Udupi',
      latitude: 13.3512,
      longitude: 74.6978,
      source: 'manual',
    },
    assignedIncidentId: null,
  },
  {
    id: 'UNIT-SDRF-02',
    name: 'SDRF Coastal Command Unit 2',
    agency: 'SDRF',
    callSign: 'Cobra-2',
    leader: 'Sub-Insp. Vinod Shenoy',
    phone: '+91 94482 23456',
    personnelCount: 14,
    status: 'available',
    capabilities: ['water_rescue', 'debris_clearance', 'evacuation'],
    baseLocation: {
      label: 'Kundapura Flood Base',
      locality: 'Kundapura',
      taluk: 'Kundapura',
      district: 'Udupi',
      latitude: 13.6268,
      longitude: 74.6922,
      source: 'manual',
    },
    currentLocation: {
      label: 'Kundapura Flood Base',
      locality: 'Kundapura',
      taluk: 'Kundapura',
      district: 'Udupi',
      latitude: 13.6268,
      longitude: 74.6922,
      source: 'manual',
    },
    assignedIncidentId: null,
  },
  {
    id: 'UNIT-QRT-MED-01',
    name: 'District Medical Quick Reaction Ambulance Unit',
    agency: 'District Health',
    callSign: 'Lifeline-1',
    leader: 'Dr. Priya Rao',
    phone: '+91 94483 34567',
    personnelCount: 8,
    status: 'available',
    capabilities: ['medical_triage', 'evacuation'],
    baseLocation: {
      label: 'Udupi District Hospital',
      locality: 'Brahmagiri',
      taluk: 'Udupi',
      district: 'Udupi',
      latitude: 13.3364,
      longitude: 74.7421,
      source: 'manual',
    },
    currentLocation: {
      label: 'Udupi District Hospital',
      locality: 'Brahmagiri',
      taluk: 'Udupi',
      district: 'Udupi',
      latitude: 13.3364,
      longitude: 74.7421,
      source: 'manual',
    },
    assignedIncidentId: null,
  },
  {
    id: 'UNIT-FIRE-01',
    name: 'Karnataka Fire & Emergency Services Rescue Team',
    agency: 'Fire & Emergency',
    callSign: 'Blaze-4',
    leader: 'Station Officer K. Poojary',
    phone: '+91 94484 45678',
    personnelCount: 12,
    status: 'available',
    capabilities: ['debris_clearance', 'water_rescue', 'evacuation'],
    baseLocation: {
      label: 'Udupi Central Fire Station',
      locality: 'Bannanje',
      taluk: 'Udupi',
      district: 'Udupi',
      latitude: 13.3440,
      longitude: 74.7480,
      source: 'manual',
    },
    currentLocation: {
      label: 'Udupi Central Fire Station',
      locality: 'Bannanje',
      taluk: 'Udupi',
      district: 'Udupi',
      latitude: 13.3440,
      longitude: 74.7480,
      source: 'manual',
    },
    assignedIncidentId: null,
  },
  {
    id: 'UNIT-CIVIL-01',
    name: 'Civil Defense Supply & Shelter Logistics Team',
    agency: 'Civil Defense',
    callSign: 'Care-1',
    leader: 'Warden S. Hegde',
    phone: '+91 94485 56789',
    personnelCount: 16,
    status: 'available',
    capabilities: ['supply_distribution', 'evacuation'],
    baseLocation: {
      label: 'Brahmavara Community Staging Depot',
      locality: 'Brahmavara',
      taluk: 'Brahmavara',
      district: 'Udupi',
      latitude: 13.4312,
      longitude: 74.7511,
      source: 'manual',
    },
    currentLocation: {
      label: 'Brahmavara Community Staging Depot',
      locality: 'Brahmavara',
      taluk: 'Brahmavara',
      district: 'Udupi',
      latitude: 13.4312,
      longitude: 74.7511,
      source: 'manual',
    },
    assignedIncidentId: null,
  },
  {
    id: 'UNIT-VOL-01',
    name: 'Byndoor Coastal Volunteer Scout Unit',
    agency: 'Volunteer Corps',
    callSign: 'Mitra-3',
    leader: 'Lead Volunteer Ganesh K.',
    phone: '+91 94486 67890',
    personnelCount: 10,
    status: 'available',
    capabilities: ['supply_distribution', 'aerial_recon'],
    baseLocation: {
      label: 'Byndoor Panchayat Relief Point',
      locality: 'Byndoor',
      taluk: 'Byndoor',
      district: 'Udupi',
      latitude: 13.8690,
      longitude: 74.6310,
      source: 'manual',
    },
    currentLocation: {
      label: 'Byndoor Panchayat Relief Point',
      locality: 'Byndoor',
      taluk: 'Byndoor',
      district: 'Udupi',
      latitude: 13.8690,
      longitude: 74.6310,
      source: 'manual',
    },
    assignedIncidentId: null,
  },
]

export const capabilityLabels: Record<SenaCapability, { label: string; icon: string }> = {
  water_rescue: { label: 'Water Rescue & Boats', icon: 'LifeBuoy' },
  medical_triage: { label: 'Medical Triage & Ambulance', icon: 'Ambulance' },
  evacuation: { label: 'Mass Evacuation & Transport', icon: 'Truck' },
  debris_clearance: { label: 'Debris & Road Clearance', icon: 'Wrench' },
  supply_distribution: { label: 'Food, Water & Supplies', icon: 'Package' },
  aerial_recon: { label: 'Drone & Visual Recon', icon: 'Radio' },
}

export function matchNeedToCapability(need: SanketAssistanceNeed): SenaCapability {
  switch (need) {
    case 'rescue':
      return 'water_rescue'
    case 'medical':
      return 'medical_triage'
    case 'evacuation':
    case 'transport':
      return 'evacuation'
    case 'shelter':
    case 'food_water':
      return 'supply_distribution'
    default:
      return 'debris_clearance'
  }
}

export function getUnitMatchScore(unit: ResponseUnit, needs: SanketAssistanceNeed[]): {
  score: number
  matchedCapabilities: SenaCapability[]
} {
  const targetCapabilities = Array.from(new Set(needs.map(matchNeedToCapability)))
  const matched = unit.capabilities.filter((c) => targetCapabilities.includes(c))
  const score = matched.length + (unit.status === 'available' ? 5 : 0)
  return { score, matchedCapabilities: matched }
}
