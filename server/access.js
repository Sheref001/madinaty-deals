export const PUBLIC_REGISTRATION_SETTING = 'public_registration_enabled';
export const PUBLIC_ACCESS_STAFF_ROLES = new Set(['ADMIN', 'MODERATOR']);

export async function publicRegistrationEnabled(prisma, fallback = true) {
  if (!prisma.systemSetting?.findUnique) return fallback;
  const setting = await prisma.systemSetting.findUnique({ where: { key: PUBLIC_REGISTRATION_SETTING }, select: { value: true } });
  return setting ? setting.value !== 'false' : fallback;
}

export async function maintenanceModeEnabled(prisma) {
  if (!prisma.systemSetting?.findUnique) return false;
  const setting = await prisma.systemSetting.findUnique({ where: { key: PUBLIC_REGISTRATION_SETTING }, select: { value: true } });
  return setting?.value === 'false';
}

export function staffMayAccessDuringMaintenance(user) {
  return PUBLIC_ACCESS_STAFF_ROLES.has(user?.role);
}
