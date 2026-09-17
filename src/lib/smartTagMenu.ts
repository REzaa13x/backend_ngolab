export type SmartTagAvailabilityOverride = 'auto' | 'force_off';

export function desiredSmartTagDisplayed(override: SmartTagAvailabilityOverride): 0 | 1 {
  return override === 'auto' ? 1 : 0;
}

export function smartTagMenuPathId(value: unknown): string {
  const id = String(value ?? '');
  if (!/^\d+$/.test(id)) throw new Error('ID menu Smart Tag tidak valid.');
  return encodeURIComponent(id);
}

export function parseMenuMutationTarget(source: unknown, outlet: unknown): {
  source: 'smart-tag' | 'local';
  outlet: 'ngolab' | 'coworking';
} {
  if (source !== 'smart-tag' && source !== 'local') throw new Error('Sumber menu tidak valid.');
  if (outlet !== 'ngolab' && outlet !== 'coworking') throw new Error('Outlet tidak valid.');
  if (source === 'smart-tag' && outlet !== 'ngolab') throw new Error('Smart Tag hanya berlaku untuk outlet Ngolab.');
  return { source, outlet };
}

export function serializeSmartTagMenu(item: any, smartTagBaseUrl: string) {
  const stock = Number(item.stock || 0);
  const displayed = Number(item.displayed ?? (item.status === 'Tersedia' ? 1 : 0)) === 1 ? 1 : 0;
  const inventoryAvailable = stock > 0;
  const inStock = item.status === 'Tersedia' && displayed === 1 && inventoryAvailable;
  const manuallyDisabled = !inStock && inventoryAvailable && displayed === 0;
  const imageValue = item.image_url || item.image || '';
  const image = imageValue.startsWith('/')
    ? `${smartTagBaseUrl.replace(/\/$/, '')}${imageValue}`
    : imageValue || `https://picsum.photos/seed/${encodeURIComponent(String(item.name || 'menu'))}/400/300`;
  const description = item.description || item.deskripsi || '';

  return {
    id: String(item.id),
    name: String(item.name || 'Menu tanpa nama'),
    category: String(item.category || 'Lainnya'),
    price: Number(item.price || 0),
    inStock,
    displayed,
    stock,
    outlet: 'ngolab' as const,
    image,
    description,
    deskripsi: description,
    isActive: true,
    inventoryAvailable,
    availabilityOverride: (manuallyDisabled ? 'force_off' : 'auto') as SmartTagAvailabilityOverride,
    availabilityReason: manuallyDisabled ? 'Dinonaktifkan melalui Smart Tag' : '',
    availabilityUpdatedBy: 'Smart Tag',
    availabilityUpdatedAt: null,
    unavailableReason: inStock ? 'available' as const : manuallyDisabled ? 'manual' as const : 'inventory' as const,
    source: 'smart-tag' as const,
  };
}
