import type { MilkType } from '@/stores/babies'

// Real color reference, not an arbitrary category color: colostrum is
// thick and golden/amber, mature milk is thin and near-white - the
// droplet's own fill communicates which one at a glance, same
// reasoning as the diaper residue-color dot in
// `lib/diaperResidueColor.ts`.
export const MILK_TYPE_DROPLET_FILL: Record<MilkType, string> = {
  calostro: '#D9A441',
  leche: '#FFFFFF',
}
