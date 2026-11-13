// Pendaftaran mandiri dari halaman login admin hanya untuk PEGAWAI.
// Daftar putih ini sengaja kecil: Super Admin/Admin tidak boleh dibuat sendiri
// lewat form publik, dan 'Pelanggan' bukan peran staf.

export const PUBLIC_STAFF_ROLES = ['Kasir', 'Koki', 'Support'] as const;
export type PublicStaffRole = (typeof PUBLIC_STAFF_ROLES)[number];

export function isPublicStaffRole(value: unknown): value is PublicStaffRole {
  return typeof value === 'string' && (PUBLIC_STAFF_ROLES as readonly string[]).includes(value);
}

// Role yang tidak pernah boleh didaftarkan sendiri (untuk pesan penolakan).
export const RESERVED_STAFF_ROLES = ['Super Admin', 'Admin'] as const;
