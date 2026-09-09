import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Liveness and readiness for the platform's health check.
 *
 * Hosts restart a container that fails this, so it must test the one thing that
 * makes the app useless while still being cheap: whether the database answers.
 * A process that is up but cannot reach Postgres serves 500s on every page, and
 * a health check that only proves Node is running would happily keep it in the
 * load balancer.
 *
 * Deliberately unauthenticated and deliberately terse. It reports up or down
 * and nothing else — no version, no connection string, no table counts — since
 * anyone on the internet can call it.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }
}
