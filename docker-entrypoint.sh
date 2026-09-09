#!/bin/sh
set -e

# Migrations run here, before the server starts, rather than in a release
# command. Every host worth using either lacks a release phase or makes it
# optional, and a container that boots against an un-migrated database serves
# 500s that look like application bugs.
#
# `migrate deploy` only applies migrations that already exist — it never
# generates one and never prompts, which is what makes it safe to run
# unattended. `migrate dev` would try to do both.
echo "→ applying migrations"
npx prisma migrate deploy

echo "→ starting server"
exec npm run start
