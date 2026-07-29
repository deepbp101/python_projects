-- CreateEnum
CREATE TYPE "CollaboratorRole" AS ENUM ('OWNER', 'PARTNER', 'PLANNER', 'FAMILY');

-- CreateEnum
CREATE TYPE "CollaboratorStatus" AS ENUM ('INVITED', 'ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "WorkspaceSection" AS ENUM ('TASKS', 'BUDGET', 'GUESTS', 'VENDORS', 'SEATING', 'MOODBOARD', 'WEBSITE');

-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('NONE', 'VIEW', 'EDIT');

-- CreateEnum
CREATE TYPE "Milestone" AS ENUM ('TWELVE_MONTHS', 'NINE_MONTHS', 'SIX_MONTHS', 'THREE_MONTHS', 'ONE_MONTH', 'ONE_WEEK', 'DAY_OF', 'AFTER');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "AgeGroup" AS ENUM ('ADULT', 'CHILD', 'INFANT');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('PENDING', 'ATTENDING', 'DECLINED', 'MAYBE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weddings" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "weddingDate" TIMESTAMP(3) NOT NULL,
    "venueName" TEXT,
    "location" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "totalBudget" INTEGER NOT NULL DEFAULT 0,
    "coverImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaborators" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "CollaboratorRole" NOT NULL DEFAULT 'FAMILY',
    "status" "CollaboratorStatus" NOT NULL DEFAULT 'INVITED',
    "inviteTokenHash" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "invitedById" TEXT,
    "joinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaborators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaborator_permissions" (
    "id" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "section" "WorkspaceSection" NOT NULL,
    "access" "AccessLevel" NOT NULL DEFAULT 'VIEW',

    CONSTRAINT "collaborator_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'General',
    "milestone" "Milestone" NOT NULL,
    "dueDate" TIMESTAMP(3),
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "templateKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_categories" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plannedAmount" INTEGER NOT NULL DEFAULT 0,
    "alertThresholdPct" INTEGER NOT NULL DEFAULT 90,
    "color" TEXT NOT NULL DEFAULT '#B08968',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_items" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendorName" TEXT,
    "plannedAmount" INTEGER NOT NULL DEFAULT 0,
    "actualAmount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "budgetItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Payment',
    "amount" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "method" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "households" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guests" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "householdId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "ageGroup" "AgeGroup" NOT NULL DEFAULT 'ADULT',
    "dietaryRestrictions" TEXT,
    "notes" TEXT,
    "plusOneAllowed" BOOLEAN NOT NULL DEFAULT false,
    "plusOneOfGuestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_tags" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#7D8471',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_tags_on_guests" (
    "guestId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "guest_tags_on_guests_pkey" PRIMARY KEY ("guestId","tagId")
);

-- CreateTable
CREATE TABLE "meal_options" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rsvps" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "status" "RsvpStatus" NOT NULL DEFAULT 'PENDING',
    "mealOptionId" TEXT,
    "respondedAt" TIMESTAMP(3),
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rsvps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "weddings_slug_key" ON "weddings"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "collaborators_inviteTokenHash_key" ON "collaborators"("inviteTokenHash");

-- CreateIndex
CREATE INDEX "collaborators_weddingId_idx" ON "collaborators"("weddingId");

-- CreateIndex
CREATE INDEX "collaborators_userId_idx" ON "collaborators"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "collaborators_weddingId_email_key" ON "collaborators"("weddingId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "collaborator_permissions_collaboratorId_section_key" ON "collaborator_permissions"("collaboratorId", "section");

-- CreateIndex
CREATE INDEX "tasks_weddingId_milestone_idx" ON "tasks"("weddingId", "milestone");

-- CreateIndex
CREATE INDEX "tasks_weddingId_dueDate_idx" ON "tasks"("weddingId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_weddingId_templateKey_key" ON "tasks"("weddingId", "templateKey");

-- CreateIndex
CREATE INDEX "budget_categories_weddingId_idx" ON "budget_categories"("weddingId");

-- CreateIndex
CREATE UNIQUE INDEX "budget_categories_weddingId_name_key" ON "budget_categories"("weddingId", "name");

-- CreateIndex
CREATE INDEX "budget_items_weddingId_idx" ON "budget_items"("weddingId");

-- CreateIndex
CREATE INDEX "budget_items_categoryId_idx" ON "budget_items"("categoryId");

-- CreateIndex
CREATE INDEX "payments_budgetItemId_idx" ON "payments"("budgetItemId");

-- CreateIndex
CREATE INDEX "payments_dueDate_idx" ON "payments"("dueDate");

-- CreateIndex
CREATE INDEX "households_weddingId_idx" ON "households"("weddingId");

-- CreateIndex
CREATE UNIQUE INDEX "guests_plusOneOfGuestId_key" ON "guests"("plusOneOfGuestId");

-- CreateIndex
CREATE INDEX "guests_weddingId_idx" ON "guests"("weddingId");

-- CreateIndex
CREATE INDEX "guests_householdId_idx" ON "guests"("householdId");

-- CreateIndex
CREATE INDEX "guest_tags_weddingId_idx" ON "guest_tags"("weddingId");

-- CreateIndex
CREATE UNIQUE INDEX "guest_tags_weddingId_name_key" ON "guest_tags"("weddingId", "name");

-- CreateIndex
CREATE INDEX "guest_tags_on_guests_tagId_idx" ON "guest_tags_on_guests"("tagId");

-- CreateIndex
CREATE INDEX "meal_options_weddingId_idx" ON "meal_options"("weddingId");

-- CreateIndex
CREATE UNIQUE INDEX "meal_options_weddingId_name_key" ON "meal_options"("weddingId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "rsvps_guestId_key" ON "rsvps"("guestId");

-- CreateIndex
CREATE INDEX "rsvps_mealOptionId_idx" ON "rsvps"("mealOptionId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborator_permissions" ADD CONSTRAINT "collaborator_permissions_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "collaborators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "collaborators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "budget_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "budget_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "households" ADD CONSTRAINT "households_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_plusOneOfGuestId_fkey" FOREIGN KEY ("plusOneOfGuestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_tags" ADD CONSTRAINT "guest_tags_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_tags_on_guests" ADD CONSTRAINT "guest_tags_on_guests_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_tags_on_guests" ADD CONSTRAINT "guest_tags_on_guests_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "guest_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_options" ADD CONSTRAINT "meal_options_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_mealOptionId_fkey" FOREIGN KEY ("mealOptionId") REFERENCES "meal_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
