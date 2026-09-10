export type MenuAvailabilityOverride = 'auto' | 'force_off';
export type MenuAvailabilityReason = 'available' | 'archived' | 'manual' | 'inventory';

export function getEffectiveMenuAvailability(
  isActive: boolean,
  override: MenuAvailabilityOverride,
  inventoryAvailable: boolean
): boolean {
  return Boolean(isActive && override !== 'force_off' && inventoryAvailable);
}

export function getMenuAvailabilityReason(input: {
  isActive: boolean;
  override: MenuAvailabilityOverride;
  inventoryAvailable: boolean;
}): MenuAvailabilityReason {
  if (!input.isActive) return 'archived';
  if (input.override === 'force_off') return 'manual';
  if (!input.inventoryAvailable) return 'inventory';
  return 'available';
}
