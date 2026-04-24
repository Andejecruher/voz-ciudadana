-- CreateEnum
CREATE TYPE "source_channel" AS ENUM ('whatsapp', 'web', 'event', 'referral', 'other');

-- CreateEnum
CREATE TYPE "lead_status" AS ENUM ('new', 'contacted', 'engaged', 'converted', 'unsubscribed');

-- CreateEnum
CREATE TYPE "conversation_status" AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "conversation_channel" AS ENUM ('whatsapp', 'web_chat', 'email', 'sms', 'other');

-- CreateEnum
CREATE TYPE "message_direction" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "message_type" AS ENUM ('text', 'image', 'audio', 'video', 'document', 'location', 'template', 'interactive', 'system');

-- DropForeignKey
ALTER TABLE "citizens" DROP CONSTRAINT "citizens_colonyId_fkey";

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_assignedDeptId_fkey";

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_citizenId_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_conversationId_fkey";

-- DropIndex
DROP INDEX "citizens_status_idx";

-- DropIndex
DROP INDEX "conversations_citizenId_idx";

-- DropIndex
DROP INDEX "conversations_status_idx";

-- DropIndex
DROP INDEX "messages_conversationId_idx";

-- DropIndex
DROP INDEX "messages_waMessageId_idx";

-- DropIndex
DROP INDEX "messages_waMessageId_key";

-- AlterTable
ALTER TABLE "citizens" DROP CONSTRAINT "citizens_pkey",
DROP COLUMN "colonyId",
DROP COLUMN "createdAt",
DROP COLUMN "fullName",
DROP COLUMN "status",
DROP COLUMN "updatedAt",
ADD COLUMN     "consent_at" TIMESTAMPTZ(6),
ADD COLUMN     "consent_given" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "email" VARCHAR(255),
ADD COLUMN     "last_name" VARCHAR(255),
ADD COLUMN     "lead_status" "lead_status" NOT NULL DEFAULT 'new',
ADD COLUMN     "name" VARCHAR(255),
ADD COLUMN     "neighborhood" VARCHAR(255),
ADD COLUMN     "neighborhood_id" UUID,
ADD COLUMN     "source_channel" "source_channel" NOT NULL DEFAULT 'whatsapp',
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "phone" SET DATA TYPE VARCHAR(30),
DROP COLUMN "interests",
ADD COLUMN     "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD CONSTRAINT "citizens_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_pkey",
DROP COLUMN "assignedDeptId",
DROP COLUMN "citizenId",
DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "assigned_dept" VARCHAR(100),
ADD COLUMN     "assigned_user_id" UUID,
ADD COLUMN     "channel" "conversation_channel" NOT NULL DEFAULT 'whatsapp',
ADD COLUMN     "citizen_id" UUID NOT NULL,
ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "conversation_status" NOT NULL DEFAULT 'open',
ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "messages" DROP CONSTRAINT "messages_pkey",
DROP COLUMN "conversationId",
DROP COLUMN "createdAt",
DROP COLUMN "waMessageId",
ADD COLUMN     "attachment_id" UUID,
ADD COLUMN     "conversation_id" UUID NOT NULL,
ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "external_message_id" VARCHAR(255),
ADD COLUMN     "message_type" "message_type" NOT NULL DEFAULT 'text',
ADD COLUMN     "meta" JSONB NOT NULL DEFAULT '{}',
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "direction",
ADD COLUMN     "direction" "message_direction" NOT NULL,
ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "colonies";

-- DropTable
DROP TABLE "departments";

-- DropEnum
DROP TYPE "CitizenStatus";

-- DropEnum
DROP TYPE "ConversationStatus";

-- DropEnum
DROP TYPE "MessageDirection";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "hashed_password" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_superuser" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "neighborhoods" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "name_lower" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "zone" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "neighborhoods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "storage_key" VARCHAR(1024) NOT NULL,
    "mime_type" VARCHAR(127) NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "original_filename" VARCHAR(512),
    "cdn_url" TEXT,
    "message_id" UUID,
    "citizen_id" UUID,
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "color" VARCHAR(20),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citizen_tags" (
    "id" UUID NOT NULL,
    "citizen_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "assigned_by_id" UUID,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "citizen_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "roles_name_idx" ON "roles"("name");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_roles_user_role" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "neighborhoods_name_key" ON "neighborhoods"("name");

-- CreateIndex
CREATE INDEX "neighborhoods_name_idx" ON "neighborhoods"("name");

-- CreateIndex
CREATE INDEX "neighborhoods_name_lower_idx" ON "neighborhoods"("name_lower");

-- CreateIndex
CREATE INDEX "neighborhoods_zone_idx" ON "neighborhoods"("zone");

-- CreateIndex
CREATE INDEX "attachments_message_id_idx" ON "attachments"("message_id");

-- CreateIndex
CREATE INDEX "attachments_citizen_id_idx" ON "attachments"("citizen_id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "tags_name_idx" ON "tags"("name");

-- CreateIndex
CREATE INDEX "citizen_tags_citizen_id_idx" ON "citizen_tags"("citizen_id");

-- CreateIndex
CREATE INDEX "citizen_tags_tag_id_idx" ON "citizen_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_citizen_tags_citizen_tag" ON "citizen_tags"("citizen_id", "tag_id");

-- CreateIndex
CREATE INDEX "citizens_email_idx" ON "citizens"("email");

-- CreateIndex
CREATE INDEX "conversations_assigned_user_id_idx" ON "conversations"("assigned_user_id");

-- CreateIndex
CREATE INDEX "messages_external_message_id_idx" ON "messages"("external_message_id");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citizens" ADD CONSTRAINT "citizens_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "neighborhoods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_citizen_id_fkey" FOREIGN KEY ("citizen_id") REFERENCES "citizens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_citizen_id_fkey" FOREIGN KEY ("citizen_id") REFERENCES "citizens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citizen_tags" ADD CONSTRAINT "citizen_tags_citizen_id_fkey" FOREIGN KEY ("citizen_id") REFERENCES "citizens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citizen_tags" ADD CONSTRAINT "citizen_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citizen_tags" ADD CONSTRAINT "citizen_tags_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

