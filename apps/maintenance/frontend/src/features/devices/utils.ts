import { Device } from "@/shared/types";

export interface DeviceGroup {
  id: string;
  name: string;
  devices: Device[];
}

/** Id of the synthetic group that collects devices whose household is not in the caller's household list. */
export const OTHER_GROUP_ID = "other";

/**
 * Groups devices by household, in the order of `households`. Households without devices are left out and
 * devices of unknown households are collected in a trailing group named `otherName`.
 */
export function groupDevicesByHousehold(
  devices: Device[],
  households: { id: string; name: string }[],
  otherName: string,
): DeviceGroup[] {
  const groups: DeviceGroup[] = [];
  for (const household of households) {
    const inHousehold = devices.filter((d) => d.household_id === household.id);
    if (inHousehold.length > 0) groups.push({ id: household.id, name: household.name, devices: inHousehold });
  }
  const orphans = devices.filter((d) => !households.some((h) => h.id === d.household_id));
  if (orphans.length > 0) groups.push({ id: OTHER_GROUP_ID, name: otherName, devices: orphans });
  return groups;
}
