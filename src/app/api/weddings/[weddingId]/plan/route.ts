import { ok, requireWorkspace, route } from "@/lib/api";
import { loadPlanSummary } from "@/lib/services/plan";

type Params = { params: Promise<{ weddingId: string }> };

/**
 * The workspace's plan, its limits and what has been used against them.
 *
 * The settings page reads this straight from the service as a server
 * component; the native app cannot, so the same summary is served over HTTP.
 * Read-only — unlocking Pro stays at plan/unlock, which is a different thing
 * with a different permission.
 *
 * Gated on TASKS view rather than an owner check: every collaborator sees the
 * plan banner when a limit bites, so every collaborator may read what the limit
 * is. Nothing here is private to the couple.
 */
export const GET = route(async (_request: Request, { params }: Params) => {
  const { weddingId } = await params;
  await requireWorkspace(weddingId, "TASKS", "VIEW");

  return ok(await loadPlanSummary(weddingId));
});
