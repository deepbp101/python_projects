import { ok, parseBody, requireWorkspaceOwner, route } from "@/lib/api";
import { guardLookup } from "@/lib/rate-limit";
import { loadPlanSummary, redeemUnlockCode } from "@/lib/services/plan";
import { unlockCodeSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string }> };

/**
 * Redeems a one-time Pro unlock code.
 *
 * The couple only — Pro is bought for the wedding, and a planner or a relative
 * spending someone's code is not a default anyone would pick.
 *
 * Rate limited despite being authenticated. A code is a bearer credential with
 * about 99 bits behind it, so guessing is hopeless, but "hopeless" assumes nobody
 * gets to try a few thousand times a minute against every wedding they own.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  await requireWorkspaceOwner(weddingId);
  await guardLookup(request, `unlock:${weddingId}`);

  const { code } = await parseBody(request, unlockCodeSchema);
  await redeemUnlockCode(weddingId, code);

  // The whole summary comes back — including the unlock date — so the panel
  // repaints from one source of truth rather than patching a plan name into
  // stale counts.
  return ok(await loadPlanSummary(weddingId));
});
