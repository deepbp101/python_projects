import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import type {
  AccessLevel,
  CollaboratorRole,
  WorkspaceSection,
} from "@/generated/prisma/enums";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  hasAccess,
  resolveAllAccess,
  type PermissionRow,
} from "@/lib/permissions";

/** An error with an HTTP status attached, thrown freely inside route handlers. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const unauthorized = (msg = "You need to sign in.") =>
  new ApiError(401, msg);
export const forbidden = (msg = "You do not have access to that.") =>
  new ApiError(403, msg);
export const notFound = (msg = "Not found.") => new ApiError(404, msg);
export const badRequest = (msg: string, details?: unknown) =>
  new ApiError(400, msg, details);

/**
 * Wraps a route handler so thrown ApiErrors and Zod failures become clean JSON
 * responses instead of 500s, and unexpected errors are logged server-side
 * without leaking internals to the client.
 */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json(
          { error: error.message, details: error.details },
          { status: error.status },
        );
      }
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: "Some fields need fixing.", details: error.issues },
          { status: 422 },
        );
      }
      console.error("Unhandled route error:", error);
      return NextResponse.json(
        { error: "Something went wrong on our end." },
        { status: 500 },
      );
    }
  };
}

/** Parses a JSON body against a schema, turning bad JSON into a 400. */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw badRequest("Expected a JSON body.");
  }
  return schema.parse(raw);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

export type WorkspaceContext = {
  user: SessionUser;
  wedding: {
    id: string;
    slug: string;
    title: string;
    weddingDate: Date;
    currency: string;
    totalBudget: number;
    venueName: string | null;
    location: string | null;
    timezone: string;
  };
  collaboratorId: string;
  role: CollaboratorRole;
  access: Record<WorkspaceSection, AccessLevel>;
};

/**
 * Loads the wedding and asserts the signed-in user may act on `section`.
 *
 * Every workspace route goes through here — authorisation is never left to the
 * client, and a user who is not a collaborator gets a 404 rather than a 403 so
 * the existence of other couples' weddings is not disclosed.
 */
export async function requireWorkspace(
  weddingId: string,
  section: WorkspaceSection,
  required: AccessLevel = "VIEW",
): Promise<WorkspaceContext> {
  const user = await requireUser();

  const collaborator = await prisma.collaborator.findFirst({
    where: {
      weddingId,
      userId: user.id,
      status: "ACTIVE",
    },
    include: { wedding: true, permissions: true },
  });

  if (!collaborator) throw notFound("That wedding does not exist.");

  const permissions: PermissionRow[] = collaborator.permissions.map((p) => ({
    section: p.section,
    access: p.access,
  }));

  if (!hasAccess(collaborator.role, permissions, section, required)) {
    throw forbidden(
      required === "EDIT"
        ? "You have view-only access to this section."
        : "You do not have access to this section.",
    );
  }

  const { wedding } = collaborator;

  return {
    user,
    wedding: {
      id: wedding.id,
      slug: wedding.slug,
      title: wedding.title,
      weddingDate: wedding.weddingDate,
      currency: wedding.currency,
      totalBudget: wedding.totalBudget,
      venueName: wedding.venueName,
      location: wedding.location,
      timezone: wedding.timezone,
    },
    collaboratorId: collaborator.id,
    role: collaborator.role,
    access: resolveAllAccess(collaborator.role, permissions),
  };
}

/** Asserts the user is one of the couple, for workspace-level management. */
export async function requireWorkspaceOwner(weddingId: string) {
  const context = await requireWorkspace(weddingId, "TASKS", "VIEW");
  if (context.role !== "OWNER" && context.role !== "PARTNER") {
    throw forbidden("Only the couple can change workspace settings.");
  }
  return context;
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
