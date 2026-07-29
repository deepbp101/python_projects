import { ok, route } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";

export const GET = route(async () => {
  return ok({ user: await getCurrentUser() });
});
