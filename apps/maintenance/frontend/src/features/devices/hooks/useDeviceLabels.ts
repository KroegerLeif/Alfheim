import { useTranslations } from "next-intl";

/**
 * Localized labels for values that the backend stores as plain English identifiers (device status and
 * category). Unknown values, for example a category typed in by another client, are shown as stored.
 */
export function useDeviceLabels() {
  const t = useTranslations("maintenance");

  const statusLabel = (status: string): string => {
    switch (status) {
      case "active":
        return t("deviceStatus.active");
      case "maintenance":
        return t("deviceStatus.maintenance");
      case "inactive":
        return t("deviceStatus.inactive");
      default:
        return status;
    }
  };

  const categoryLabel = (category: string): string => {
    switch (category) {
      case "HVAC":
        return t("categories.hvac");
      case "Plumbing":
        return t("categories.plumbing");
      case "Electrical":
        return t("categories.electrical");
      case "Appliances":
        return t("categories.appliances");
      case "Security":
        return t("categories.security");
      case "Garden":
        return t("categories.garden");
      default:
        return category;
    }
  };

  return { statusLabel, categoryLabel };
}
