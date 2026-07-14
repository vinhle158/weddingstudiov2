-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "created_at" TEXT NOT NULL,
    "session_version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "permissions" TEXT[],

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "birthday" TEXT,
    "wedding_date" TEXT,
    "facebook_url" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "order_code" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "shoot_date" TEXT NOT NULL,
    "shoot_time" TEXT,
    "package_name" TEXT NOT NULL,
    "package_price" DOUBLE PRECISION NOT NULL,
    "deposit_amount" DOUBLE PRECISION NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "from_status" TEXT NOT NULL,
    "to_status" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "note" TEXT,
    "changed_at" TEXT NOT NULL,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DressInventory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "image_url" TEXT,
    "notes" TEXT,
    "created_at" TEXT NOT NULL,

    CONSTRAINT "DressInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DressRental" (
    "id" TEXT NOT NULL,
    "dress_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "rented_date" TEXT NOT NULL,
    "return_date" TEXT NOT NULL,
    "returned_at" TEXT,
    "rental_fee" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "DressRental_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order_id" TEXT,
    "assigned_to" TEXT NOT NULL,
    "assigned_by" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "due_date" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskUpdate" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "status_changed_to" TEXT,
    "comment" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,

    CONSTRAINT "TaskUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Objective" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    "completed_at" TEXT,

    CONSTRAINT "Objective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjectiveKeyResult" (
    "id" TEXT NOT NULL,
    "objective_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assigned_department" TEXT NOT NULL,
    "assigned_to_user_id" TEXT,
    "status" TEXT NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "updated_at" TEXT NOT NULL,

    CONSTRAINT "ObjectiveKeyResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjectiveProgressUpdate" (
    "id" TEXT NOT NULL,
    "key_result_id" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "progress_from" DOUBLE PRECISION NOT NULL,
    "progress_to" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "created_at" TEXT NOT NULL,

    CONSTRAINT "ObjectiveProgressUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "receiver_id" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "related_id" TEXT,
    "is_read_by" TEXT[],
    "created_at" TEXT NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "receiver_id" TEXT,
    "content" TEXT NOT NULL,
    "attachment_filename" TEXT,
    "attachment_name" TEXT,
    "attachment_mime" TEXT,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "reference_label" TEXT,
    "mentioned_user_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TEXT NOT NULL,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatReadState" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "conversation_key" TEXT NOT NULL,
    "last_read_at" TEXT NOT NULL,

    CONSTRAINT "ChatReadState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "opening_hours" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "backup_schedule" TEXT NOT NULL,
    "last_backup_time" TEXT NOT NULL,
    "anniversary_reminder_days" INTEGER NOT NULL DEFAULT 7,

    CONSTRAINT "StudioSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatabaseBackup" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "size_bytes" DOUBLE PRECISION NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "DatabaseBackup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "phone" TEXT,
    "source" TEXT NOT NULL,
    "interested_packages" JSONB NOT NULL,
    "sales_step" INTEGER NOT NULL,
    "follow_up_status" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "revenue" DOUBLE PRECISION,
    "success_reason" TEXT,
    "failure_reason" TEXT,
    "assigned_sale_id" TEXT NOT NULL,
    "support_needed" TEXT,
    "notes" TEXT,
    "admin_feedbacks" JSONB NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Order_order_code_key" ON "Order"("order_code");

-- CreateIndex
CREATE UNIQUE INDEX "DressInventory_code_key" ON "DressInventory"("code");

-- CreateIndex
CREATE INDEX "ChatReadState_user_id_idx" ON "ChatReadState"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatReadState_user_id_conversation_key_key" ON "ChatReadState"("user_id", "conversation_key");
