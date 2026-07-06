"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useLocations, useCreateLocation } from "../services/locationService";
import { useInventoryState, useLowStockItems } from "@/features/inventory/services/inventoryService";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Minus, 
  Loader2, 
  Check, 
  AlertCircle, 
  MapPin, 
  Clock, 
  AlertTriangle 
} from "lucide-react";

/**
 * LocationsGridView Component
 * Renders the physical and virtual storage location layout.
 * Displays warning badges:
 *   - "X MHD": number of expired items in that location.
 *   - "Y knapp": number of products currently below minimum stock in that location.
 *   - "✓ OK": if there are no warnings.
 * Also includes an inline creation form to provision new physical zones.
 */
export function LocationsGridView() {
  const t = useTranslations("Locations");

  // State to toggle inline form
  const [isFormOpen, setIsFormOpen] = React.useState(false);

  // Form inputs
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");

  // Feedback states
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Queries & Mutations
  const { data: locations = [], isLoading: isLoadingLocs } = useLocations();
  const { data: states = [], isLoading: isLoadingStates } = useInventoryState();
  const { data: lowStockItems = [], isLoading: isLoadingLowStock } = useLowStockItems();
  const createLocationMut = useCreateLocation();

  // Parse today's date for expiration checking
  const todayStr = new Date().toISOString().split("T")[0];

  // Map of low stock product IDs
  const lowStockProductIds = React.useMemo(() => {
    return new Set(lowStockItems.map((item) => item.product.id));
  }, [lowStockItems]);

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!name.trim()) {
      setErrorMessage("Location name is required.");
      return;
    }

    createLocationMut.mutate(
      {
        name: name.trim(),
        description: description.trim() || null,
      },
      {
        onSuccess: () => {
          setSuccessMessage(t("success"));
          setName("");
          setDescription("");
          setIsFormOpen(false);

          setTimeout(() => {
            setSuccessMessage(null);
          }, 4000);
        },
        onError: (err: any) => {
          setErrorMessage(err.message || "Failed to create location.");
        },
      }
    );
  };

  const isLoadingData = isLoadingLocs || isLoadingStates || isLoadingLowStock;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background text-foreground font-mono p-8 space-y-6">
      {/* Top Bar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-6 gap-4">
        <div>
          <h1 className="text-4xl font-heading font-black tracking-wide leading-none select-none">
            {t("title")}
          </h1>
          <p className="uppercase tracking-widest text-[10px] text-muted-foreground mt-2 font-mono">
            {t("subtitle")}
          </p>
        </div>

        <Button
          id="toggle-create-location"
          onClick={() => {
            setIsFormOpen(!isFormOpen);
            clearMessages();
          }}
          variant="outline"
          className="py-6 px-6 font-black tracking-widest border-2 border-black hover:bg-black hover:text-white cursor-pointer select-none transition-all h-12 flex items-center justify-center gap-2 self-start"
        >
          {isFormOpen ? (
            <>
              <Minus className="h-4 w-4" />
              {t("createBtnClose")}
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              {t("createBtn")}
            </>
          )}
        </Button>
      </div>

      {/* Collapsible Inline Creation Form */}
      {isFormOpen && (
        <div className="border border-border bg-neutral-50 p-6 max-w-xl animate-in fade-in slide-in-from-top-4 duration-200">
          <h2 className="text-xl font-heading font-black tracking-wide border-b border-border pb-2 mb-4">
            {t("createTitle")}
          </h2>

          {errorMessage && (
            <div className="border border-destructive bg-red-50 text-destructive p-3 text-xs flex items-start gap-2 uppercase font-bold leading-normal mb-4">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Location Name */}
            <div className="space-y-1.5">
              <label htmlFor="location-name" className="text-xs font-bold uppercase tracking-wider block">
                {t("name")} *
              </label>
              <input
                id="location-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearMessages();
                }}
                placeholder="e.g. Basement Room A"
                required
                className="w-full py-3 px-3 border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring text-sm h-12 uppercase font-mono"
              />
            </div>

            {/* Location Description */}
            <div className="space-y-1.5">
              <label htmlFor="location-description" className="text-xs font-bold uppercase tracking-wider block">
                {t("description")}
              </label>
              <textarea
                id="location-description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  clearMessages();
                }}
                placeholder="e.g. Shelf unit against the west wall"
                rows={3}
                className="w-full py-3 px-3 border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring text-sm uppercase font-mono resize-none"
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={createLocationMut.isPending}
                className="w-full py-6 text-xs font-black tracking-widest border-2 border-black hover:bg-black hover:text-white cursor-pointer select-none transition-all flex items-center justify-center gap-2"
              >
                {createLocationMut.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("creating")}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    {t("submit")}
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Success Notification outside form */}
      {successMessage && !isFormOpen && (
        <div className="border border-emerald-600 bg-emerald-50 text-emerald-950 p-3 text-xs flex items-start gap-2 uppercase font-bold leading-normal max-w-xl">
          <Check className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Locations Cards Grid View */}
      {isLoadingData ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-xs uppercase font-bold tracking-widest text-muted-foreground">
            POLLING PHYSICAL SPACES...
          </span>
        </div>
      ) : locations.length === 0 ? (
        <div className="border border-dashed border-neutral-300 p-12 text-center text-xs text-muted-foreground uppercase tracking-widest">
          {t("noLocations")}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locations.map((loc) => {
            // Filter states specifically for this location
            const locStates = states.filter((s) => s.location_id === loc.id);

            // Compute active warning metrics
            const expiredCount = locStates.filter(
              (s) => s.expiration_date && s.expiration_date <= todayStr
            ).length;

            const knappCount = new Set(
              locStates
                .filter((s) => lowStockProductIds.has(s.product_id))
                .map((s) => s.product_id)
            ).size;

            return (
              <div 
                key={loc.id} 
                className="border border-border bg-white hover:border-black p-6 flex flex-col justify-between gap-6 transition-all"
              >
                {/* Location Title & Type Header */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-heading text-2xl font-bold uppercase tracking-wide leading-none truncate max-w-[200px]">
                      {loc.name}
                    </h3>
                    <MapPin className="h-4 w-4 text-neutral-400 shrink-0 mt-0.5" />
                  </div>

                  {loc.is_system && (
                    <span className="inline-block text-[8px] font-bold tracking-wider px-1 py-0.5 border border-neutral-300 text-neutral-400 uppercase">
                      {t("system")}
                    </span>
                  )}

                  <p className="text-[10px] text-muted-foreground uppercase leading-relaxed line-clamp-2">
                    {loc.description || "—"}
                  </p>
                </div>

                {/* Alarm Metrics Row (Badges) */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-100">
                  {expiredCount === 0 && knappCount === 0 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono px-2 py-1 uppercase tracking-wide border border-emerald-600 bg-emerald-50 text-emerald-950 select-none">
                      {t("ok")}
                    </span>
                  ) : (
                    <>
                      {expiredCount > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold font-mono px-2 py-1 uppercase tracking-wide border border-destructive bg-red-50 text-destructive select-none">
                          <Clock className="h-3 w-3 shrink-0" />
                          {expiredCount} {t("mhd")}
                        </span>
                      )}
                      {knappCount > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold font-mono px-2 py-1 uppercase tracking-wide border border-amber-600 bg-amber-50 text-amber-900 select-none">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          {knappCount} {t("knapp")}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
