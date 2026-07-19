"use client";

import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { submitMaintenance } from "@/shared/api";
import { Device, MaintenanceSubmitPayload } from "@/shared/types";
import { 
  X, 
  Check, 
  ArrowLeft, 
  ArrowRight, 
  BookOpen, 
  ShoppingCart, 
  AlertCircle,
  FileText,
  Download,
  PackagePlus,
  PackageMinus,
  Loader2
} from "lucide-react";
import { formatDate, daysUntil } from "@/shared/utils";
import { cn } from "@/shared/utils";

interface MaintenanceModeProps {
  device: Device;
  onClose: () => void;
}

export function MaintenanceMode({ device, onClose }: MaintenanceModeProps) {
  const steps = device.steps || [];
  const totalSteps = steps.length;
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const [stepNotes, setStepNotes] = useState<Record<number, string>>({});
  const [cart, setCart] = useState<string[]>([]);

  const activeStep = steps[currentStepIndex];
  const queryClient = useQueryClient();

  // Load cart from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("cart_maintenance-frontend");
      if (stored) {
        try {
          setCart(JSON.parse(stored));
        } catch {
          // ignore
        }
      }
    }
  }, []);

  // Save cart to localStorage
  const updateCart = (newCart: string[]) => {
    setCart(newCart);
    if (typeof window !== "undefined") {
      localStorage.setItem("cart_maintenance-frontend", JSON.stringify(newCart));
    }
  };

  // Submit mutation
  const submissionMutation = useMutation({
    mutationFn: submitMaintenance,
    onSuccess: () => {
      // Invalidate the query key to refresh list
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      
      // Clear shopping cart if items were successfully sent
      updateCart([]);
      
      onClose();
      alert("Maintenance successfully submitted and synced to database!");
    },
    onError: (error: any) => {
      alert(`Failed to save maintenance log: ${error?.message || "Unknown error"}`);
    }
  });

  if (totalSteps === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-6 font-sans">
        <div className="glass-card max-w-md w-full p-8 rounded-2xl border border-white/10 shadow-2xl text-center space-y-6">
          <AlertCircle className="h-12 w-12 text-amber-400 mx-auto" />
          <div className="space-y-2">
            <h3 className="text-lg font-black uppercase text-white tracking-wide">No Steps Defined</h3>
            <p className="text-xs text-slate-400">
              This device does not have any service steps configured. Please setup steps in details tab.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Get mock supply items for step
  const getSupplyItemForStep = (name: string): string => {
    const lowercase = name.toLowerCase();
    if (lowercase.includes("filter")) return "Air Filter Replacements (Pack of 2)";
    if (lowercase.includes("fan") || lowercase.includes("lubricant")) return "Fan Lubricant Spray";
    if (lowercase.includes("salt")) return "EcoWater Salt Bags (25kg)";
    if (lowercase.includes("sanitize") || lowercase.includes("cleaner")) return "System Disinfectant Pack";
    if (lowercase.includes("breaker") || lowercase.includes("gfci")) return "Electrical Breaker Tester";
    if (lowercase.includes("lens") || lowercase.includes("camera")) return "Camera Lens Cleaning Kit";
    if (lowercase.includes("firmware")) return "NVR Firmware Utility USB";
    if (lowercase.includes("winter")) return "Winterization Cap Valves";
    if (lowercase.includes("sieve")) return "Dishwasher Cleaner Agent";
    if (lowercase.includes("aid")) return "Miele Rinse Aid Liquid";
    return "Universal Cleaning & Maintenance Pack";
  };

  const currentSupplyItem = activeStep ? getSupplyItemForStep(activeStep.title) : "Universal Cleaning Pack";
  const isPartInCart = cart.includes(currentSupplyItem);

  const toggleCartPart = () => {
    if (isPartInCart) {
      updateCart(cart.filter((item) => item !== currentSupplyItem));
    } else {
      updateCart([...cart, currentSupplyItem]);
    }
  };

  const handleToggleStepDone = (stepId: number) => {
    const newDone = new Set(doneSteps);
    if (newDone.has(stepId)) {
      newDone.delete(stepId);
    } else {
      newDone.add(stepId);
    }
    setDoneSteps(newDone);
  };

  const handleNext = () => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleNoteChange = (text: string) => {
    if (!activeStep) return;
    setStepNotes({
      ...stepNotes,
      [activeStep.id]: text,
    });
  };

  const progressPercentage = Math.round((doneSteps.size / totalSteps) * 100);
  const isWizardComplete = doneSteps.size === totalSteps;

  const handleFinishWizard = () => {
    const completedStepIds = Array.from(doneSteps);
    
    // Aggregate notes from stepNotes dictionary
    const notesArray = Object.entries(stepNotes)
      .map(([id, note]) => {
        const stepTitle = steps.find(s => s.id === Number(id))?.title || "Step";
        return `${stepTitle}: ${note}`;
      })
      .filter(Boolean);
    const stepNotesMerged = notesArray.join("\n");

    const payload: MaintenanceSubmitPayload = {
      device_id: device.id,
      completed_step_ids: completedStepIds,
      step_notes: stepNotesMerged || "All service steps inspected and completed.",
      performer: "Lena Müller", // Mocked active performer
      supply_items: cart.length > 0 ? cart : null,
    };

    submissionMutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md font-sans text-white">
      {/* Top Wizard Bar */}
      <div className="h-16 border-b border-white/5 px-6 flex items-center justify-between bg-slate-950">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400 leading-none">
              Maintenance Wizard //
            </span>
            <span className="text-base font-black uppercase text-white truncate max-w-sm">
              {device.name}
            </span>
          </div>
        </div>

        {/* Progress Bar Container */}
        <div className="hidden md:flex items-center gap-4 w-96">
          <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
            <div
              className="bg-cyan-500 h-full transition-all duration-300 shadow-md shadow-cyan-500/20"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <span className="text-xs font-mono font-bold text-cyan-400 shrink-0">
            {progressPercentage}%
          </span>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
          aria-label="Exit Wizard"
          disabled={submissionMutation.isPending}
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* Progress Bar on Mobile */}
      <div className="md:hidden w-full bg-white/5 h-1 relative overflow-hidden">
        <div
          className="bg-cyan-500 h-full transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Main Grid View */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        
        {/* Left Side Column: Manuals Panel (3 cols) */}
        <div className="hidden lg:flex lg:col-span-3 border-r border-white/5 bg-slate-900/40 p-6 flex-col space-y-4 overflow-y-auto">
          <div className="flex items-center gap-2 pb-2 border-b border-white/5 text-[10px] font-black uppercase tracking-wider text-slate-500">
            <FileText className="h-4 w-4 text-slate-500" />
            <span>Direct Manuals Access</span>
          </div>
          
          {/* Mock manuals fallback */}
          <div className="space-y-2">
            <a
              href="#"
              className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors text-slate-300 hover:text-white text-xs font-semibold"
            >
              <div className="flex items-center gap-2 min-w-0">
                <BookOpen className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">User Guide PDF</span>
              </div>
              <Download className="h-3.5 w-3.5 text-slate-500 hover:text-slate-300 shrink-0" />
            </a>
          </div>
        </div>

        {/* Center Section: Active Wizard Step (6 cols) */}
        <div className="col-span-1 lg:col-span-6 flex flex-col justify-between p-6 md:p-8 overflow-y-auto">
          
          {/* Step Header */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-500">
                STEP {currentStepIndex + 1} OF {totalSteps}
              </span>
              {activeStep && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400">
                  Interval: {activeStep.recurrence}m
                </span>
              )}
            </div>

            {activeStep && (
              <div className="space-y-4">
                <h3 className="text-2xl font-black uppercase text-white tracking-wide">
                  {activeStep.title}
                </h3>
                {activeStep.description && (
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {activeStep.description}
                  </p>
                )}
              </div>
            )}

            {/* Checkbox completion */}
            {activeStep && (
              <div className="pt-4">
                <button
                  onClick={() => handleToggleStepDone(activeStep.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer font-semibold text-sm",
                    doneSteps.has(activeStep.id)
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                  )}
                  disabled={submissionMutation.isPending}
                >
                  <span>Mark this step as completed</span>
                  <div className={cn(
                    "h-6 w-6 rounded-lg border flex items-center justify-center transition-all",
                    doneSteps.has(activeStep.id)
                      ? "bg-emerald-500 border-emerald-500 text-black"
                      : "border-slate-500"
                  )}>
                    {doneSteps.has(activeStep.id) && <Check className="h-4 w-4 stroke-[3]" />}
                  </div>
                </button>
              </div>
            )}

            {/* Step specific notes */}
            {activeStep && (
              <div className="space-y-2 pt-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  Operation Notes & Comments
                </span>
                <textarea
                  value={stepNotes[activeStep.id] || ""}
                  onChange={(e) => handleNoteChange(e.target.value)}
                  placeholder="Log any anomalies, actions taken, or parts used..."
                  className="w-full h-32 p-3 bg-white/5 border border-white/5 hover:border-white/10 focus:border-cyan-500/50 rounded-xl text-slate-200 text-xs focus:outline-none resize-none transition-all placeholder:text-slate-600 font-mono"
                  disabled={submissionMutation.isPending}
                />
              </div>
            )}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between gap-4 pt-8 mt-auto">
            <button
              onClick={handlePrev}
              disabled={currentStepIndex === 0 || submissionMutation.isPending}
              className={cn(
                "px-4 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer",
                currentStepIndex === 0
                  ? "border-white/5 text-slate-600 cursor-not-allowed"
                  : "border-white/5 text-slate-300 hover:bg-white/5 hover:text-white"
              )}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            {currentStepIndex === totalSteps - 1 ? (
              <button
                onClick={handleFinishWizard}
                disabled={!isWizardComplete || submissionMutation.isPending}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg",
                  isWizardComplete && !submissionMutation.isPending
                    ? "bg-emerald-500 text-black hover:bg-emerald-600 shadow-emerald-500/10"
                    : "bg-white/5 border border-white/5 text-slate-600 cursor-not-allowed"
                )}
              >
                {submissionMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 stroke-[3]" />
                    Finish & Save
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={submissionMutation.isPending}
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-black text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/10"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Right Side Column: Buy Parts Panel (3 cols) */}
        <div className="hidden lg:flex lg:col-span-3 border-l border-white/5 bg-slate-900/40 p-6 flex-col space-y-4 overflow-y-auto">
          <div className="flex items-center gap-2 pb-2 border-b border-white/5 text-[10px] font-black uppercase tracking-wider text-slate-500">
            <ShoppingCart className="h-4 w-4 text-slate-500" />
            <span>Associated Supplies</span>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 block">Required Part</span>
              <p className="text-xs font-bold text-white leading-tight">{currentSupplyItem}</p>
            </div>

            <button
              onClick={toggleCartPart}
              disabled={submissionMutation.isPending}
              className={cn(
                "w-full py-2.5 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                isPartInCart
                  ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
                  : "bg-cyan-500 hover:bg-cyan-600 text-black border-transparent shadow-lg shadow-cyan-500/5"
              )}
            >
              {isPartInCart ? (
                <>
                  <PackageMinus className="h-4 w-4" />
                  Remove Cart
                </>
              ) : (
                <>
                  <PackagePlus className="h-4 w-4" />
                  Select for Cart
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
