import { useMemo } from "react";
import { useDevices } from "@/features/devices";
import { collectDueAlerts, DueAlert } from "../utils";

/** Overdue and due-soon steps of the active household, for the header notification menu. */
export function useDueAlerts(): DueAlert[] {
  const { data: devices } = useDevices();
  return useMemo(() => collectDueAlerts(devices ?? []), [devices]);
}
