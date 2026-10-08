"use client";

import { useState } from "react";
import { Button, useTranslation } from "@alfheim/shared";
import { Ban, Flag } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { InlineError } from "@/components/shared/InlineError";
import { describeError } from "@/core/errors";
import { PendingSetsError } from "../hooks/useBerserkerSession";

interface SessionActionsProps {
  onFinish: () => Promise<void>;
  onAbandon: () => Promise<void>;
  /** Called after the session was finished or abandoned, e.g. to leave the HUD. */
  onClosed: () => void;
  isFinishing: boolean;
  isAbandoning: boolean;
}

/**
 * Finish / abandon controls of the live HUD.
 *
 * Both actions report failures inline: a session that silently stays open is
 * indistinguishable from one that was closed.
 */
export function SessionActions({
  onFinish,
  onAbandon,
  onClosed,
  isFinishing,
  isAbandoning,
}: SessionActionsProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const run = async (action: () => Promise<void>, fallbackKey: string) => {
    setError(null);
    try {
      await action();
      setIsConfirmOpen(false);
      onClosed();
    } catch (err) {
      setIsConfirmOpen(false);
      setError(
        err instanceof PendingSetsError
          ? t("workout.finishPendingSets", { count: err.count })
          : describeError(err, t, fallbackKey)
      );
    }
  };

  return (
    <div className="space-y-3">
      <InlineError message={error} />

      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full"
        disabled={isFinishing || isAbandoning}
        onClick={() => void run(onFinish, "workout.finishFailed")}
      >
        <Flag aria-hidden="true" />
        {t("workout.finishSession")}
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="min-h-11 w-full text-red-400 hover:bg-red-950/20 hover:text-red-300"
        disabled={isFinishing || isAbandoning}
        onClick={() => setIsConfirmOpen(true)}
      >
        <Ban aria-hidden="true" />
        {t("workout.abandonSession")}
      </Button>

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title={t("workout.abandonSession")}
        description={t("workout.abandonConfirm")}
        confirmLabel={t("workout.abandonSession")}
        isPending={isAbandoning}
        onConfirm={() => void run(onAbandon, "workout.abandonFailed")}
      />
    </div>
  );
}
