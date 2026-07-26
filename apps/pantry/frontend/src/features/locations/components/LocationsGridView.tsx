"use client";

import * as React from "react";
import { useTranslation } from "@loeger-os/shared";
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
  const { t } = useTranslation();

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
          setSuccessMessage(t("pantry.locationSuccess"));
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
    <div className="flex-1 flex flex-col min-w-0 bg-[var(--surface-canvas)] text-[var(--text-main)] font-mono p-8 space-y-6">
      {/* Top Bar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[var(--border-subtle)] pb-6 gap-4">
        <div>
          <h1 className="text-4xl font-heading font-black tracking-wide leading-none select-none text-[var(--text-main)]">
            {t("pantry.locationsTitle")}
          </h1>
          <p className="uppercase tracking-widest text-[10px] text-[var(--text-muted)] mt-2 font-mono">
            {t("pantry.locationsSub")}
          </p>
        </div>

        <Button
          id="toggle-create-location"
          onClick={() => {
            setIsFormOpen(!isFormOpen);
            clearMessages();
          }}
          variant="outline"
          className="py-6 px-6 font-black tracking-widest border-2 border-[var(--border-accent)] bg-[var(--surface-card)] text-[var(--primary-main)] hover:bg-[var(--primary-main)] hover:text-black cursor-pointer select-none transition-all h-12 flex items-center justify-center gap-2 self-start rounded-lg"
        >
          {isFormOpen ? (
            <>
              <Minus className="h-4 w-4" />
              {t("pantry.createBtnClose")}
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              {t("pantry.createBtn")}
            </>
          )}
        </Button>
      </div>

      {/* Collapsible Inline Creation Form */}
      {isFormOpen && (
        <div className="border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 max-w-xl animate-in fade-in slide-in-from-top-4 duration-200 rounded-lg shadow-sm">
          <h2 className="text-xl font-heading font-black tracking-wide border-b border-[var(--border-subtle)] pb-2 mb-4 text-[var(--text-main)]">
            {t("pantry.createLocationTitle")}
          </h2>

          {errorMessage && (
            <div className="border border-red-800/40 bg-red-950/20 text-red-400 p-3 text-xs flex items-start gap-2 uppercase font-bold leading-normal mb-4 rounded">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Location Name */}
            <div className="space-y-1.5">
              <label htmlFor="location-name" className="text-xs font-bold uppercase tracking-wider block text-[var(--text-main)]">
                {t("pantry.locationName")} *
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
                className="w-full py-3 px-3 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-sm h-12 uppercase font-mono rounded"
              />
            </div>

            {/* Location Description */}
            <div className="space-y-1.5">
              <label htmlFor="location-description" className="text-xs font-bold uppercase tracking-wider block text-[var(--text-main)]">
                {t("pantry.locationDesc")}
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
                className="w-full py-3 px-3 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-sm uppercase font-mono resize-none rounded"
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={createLocationMut.isPending}
                className="w-full py-6 text-xs font-black tracking-widest border-2 border-[var(--border-accent)] bg-[var(--primary-main)] text-black hover:bg-[var(--primary-hover)] cursor-pointer select-none transition-all flex items-center justify-center gap-2 rounded-lg"
              >
                {createLocationMut.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("pantry.creatingLocation")}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    {t("pantry.submitLocation")}
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Success Notification outside form */}
      {successMessage && !isFormOpen && (
        <div className="border border-emerald-800/40 bg-emerald-950/20 text-emerald-400 p-3 text-xs flex items-start gap-2 uppercase font-bold leading-normal max-w-xl rounded">
          <Check className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Locations Cards Grid View */}
      {isLoadingData ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary-main)]" />
          <span className="text-xs uppercase font-bold tracking-widest text-[var(--text-muted)]">
            POLLING PHYSICAL SPACES...
          </span>
        </div>
      ) : locations.length === 0 ? (
        <div className="border border-dashed border-[var(--border-subtle)] p-12 text-center text-xs text-[var(--text-muted)] uppercase tracking-widest rounded-lg">
          {t("pantry.noLocations")}
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
                className="border border-[var(--border-subtle)] bg-[var(--surface-card)] hover:border-[var(--border-accent)] p-6 flex flex-col justify-between gap-6 transition-all rounded-lg shadow-sm"
              >
                {/* Location Title & Type Header */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-heading text-2xl font-bold uppercase tracking-wide leading-none truncate max-w-[200px] text-[var(--text-main)]">
                      {loc.name}
                    </h3>
                    <MapPin className="h-4 w-4 text-[var(--text-muted)] shrink-0 mt-0.5" />
                  </div>

                  {loc.is_system && (
                    <span className="inline-block text-[8px] font-bold tracking-wider px-1 py-0.5 border border-[var(--border-subtle)] text-[var(--text-muted)] uppercase rounded">
                      {t("pantry.systemLocation")}
                    </span>
                  )}

                  <p className="text-[10px] text-[var(--text-muted)] uppercase leading-relaxed line-clamp-2 font-sans">
                    {loc.description || "—"}
                  </p>
                </div>

                {/* Alarm Metrics Row (Badges) */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border-subtle)]">
                  {expiredCount === 0 && knappCount === 0 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono px-2 py-1 uppercase tracking-wide border border-emerald-800/40 bg-emerald-950/20 text-emerald-400 select-none rounded">
                      {t("pantry.ok")}
                    </span>
                  ) : (
                    <>
                      {expiredCount > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold font-mono px-2 py-1 uppercase tracking-wide border border-red-800/40 bg-red-950/20 text-red-400 select-none rounded">
                          <Clock className="h-3 w-3 shrink-0" />
                          {expiredCount} {t("pantry.mhd")}
                        </span>
                      )}
                      {knappCount > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold font-mono px-2 py-1 uppercase tracking-wide border border-amber-800/40 bg-amber-950/20 text-amber-400 select-none rounded">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          {knappCount} {t("pantry.knapp")}
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
