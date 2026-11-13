import { AppLoading } from "@alfheim/shared/app-shell";

/** Route loading state with the workout-specific message. */
export default function Loading() {
  return <AppLoading messageKey="workout.loading" />;
}
