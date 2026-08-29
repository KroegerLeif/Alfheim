"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useTranslation,
} from "@alfheim/shared";
import { Trophy, User } from "lucide-react";
import { useLeaderboard } from "../hooks/useAnalytics";

/** The backend returns raw user id UUIDs with no display name attached. */
const USER_ID_DISPLAY_LENGTH = 8;

/**
 * Household training-volume ranking. There is no `workout.*` translation key
 * for a bare "user"/"member" column header (see the feature report), so that
 * header's accessible name reuses `workout.leaderboard` rather than
 * inventing a new key; the icon carries the visible affordance instead.
 */
export function LeaderboardPanel() {
  const { t } = useTranslation();
  const { data, isLoading } = useLeaderboard();

  const entries = data?.entries ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("workout.leaderboard")}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState icon={<Trophy className="h-8 w-8" />} title={t("workout.noAnalyticsData")} />
        ) : (
          <Table aria-label={t("workout.leaderboard")}>
            <TableHeader>
              <TableRow>
                <TableHead>{t("workout.rank")}</TableHead>
                <TableHead>
                  <User className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">{t("workout.leaderboard")}</span>
                </TableHead>
                <TableHead>{t("workout.totalVolume")}</TableHead>
                <TableHead>{t("workout.sessionCount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry, index) => (
                <TableRow key={entry.user_id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{entry.user_id.slice(0, USER_ID_DISPLAY_LENGTH)}</TableCell>
                  <TableCell>
                    {entry.total_volume_kg} {t("workout.unit_kg")}
                  </TableCell>
                  <TableCell>{entry.completed_session_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
