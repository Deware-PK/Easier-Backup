-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(10) NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "computers" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "os" VARCHAR(50),
    "auth_token" VARCHAR(255) NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'offline',
    "last_seen_at" TIMESTAMPTZ,
    "registered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "default_backup_keep_count" INTEGER DEFAULT 3,
    "default_retry_attempts" INTEGER DEFAULT 3,
    "default_retry_delay_seconds" INTEGER DEFAULT 5,

    CONSTRAINT "computers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" BIGSERIAL NOT NULL,
    "computer_id" BIGINT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "source_path" TEXT NOT NULL,
    "destination_path" TEXT NOT NULL,
    "schedule" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "backup_keep_count" INTEGER,
    "retry_attempts" INTEGER,
    "retry_delay_seconds" INTEGER,
    "folder_prefix" VARCHAR(50) DEFAULT 'backup_',
    "timestamp_format" VARCHAR(50) DEFAULT '%Y%m%d_%H%M%S',
    "discord_webhook_url" TEXT,
    "notification_on_success" TEXT,
    "notification_on_failure" TEXT,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_jobs" (
    "id" BIGSERIAL NOT NULL,
    "task_id" BIGINT NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "details" TEXT,

    CONSTRAINT "backup_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "computers_auth_token_key" ON "computers"("auth_token");

-- AddForeignKey
ALTER TABLE "computers" ADD CONSTRAINT "computers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_computer_id_fkey" FOREIGN KEY ("computer_id") REFERENCES "computers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
