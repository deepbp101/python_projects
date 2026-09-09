import { ok, requireWorkspace, route } from "@/lib/api";
import { searchDirectory } from "@/lib/services/vendors";
import { directoryQuerySchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string }> };

/**
 * Searches the shared vendor directory.
 *
 * Scoped under a wedding so the results can say which vendors are already on
 * this couple's shortlist, and so browsing needs VENDORS access rather than just
 * an account.
 */
export const GET = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  await requireWorkspace(weddingId, "VENDORS", "VIEW");

  const url = new URL(request.url);
  const query = directoryQuerySchema.parse({
    q: url.searchParams.get("q") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    city: url.searchParams.get("city") ?? undefined,
    minRating: url.searchParams.get("minRating") ?? 0,
    sort: url.searchParams.get("sort") ?? "RATING",
  });

  return ok({ vendors: await searchDirectory({ weddingId, ...query }) });
});
