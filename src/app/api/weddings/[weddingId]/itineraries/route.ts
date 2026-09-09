import { ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { issueItineraryLinks } from "@/lib/services/celebrations";
import { issueItinerariesSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string }> };

/**
 * Mints personal itinerary links.
 *
 * The whole list comes back at once, because that is how it gets used — the couple
 * pastes it into a mail merge or copies rows one at a time. Only hashes are
 * stored, so this response is the only time these URLs exist; regenerating issues
 * new ones and kills whatever was already sent.
 *
 * Requires GUESTS edit rather than WEBSITE: these links expose a guest's own RSVP,
 * meal and table, which is guest-list data.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  await requireWorkspace(weddingId, "GUESTS", "EDIT");
  const { regenerate } = await parseBody(request, issueItinerariesSchema);

  const links = await issueItineraryLinks(weddingId, { regenerate });

  return ok({ links, regenerated: regenerate });
});
