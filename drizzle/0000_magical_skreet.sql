CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_id" integer,
	"manager_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "electronic_devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_code" text NOT NULL,
	"category" text NOT NULL,
	"device_type" text NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"serial_number" text,
	"date_of_purchase" text NOT NULL,
	"warranty_start_date" text NOT NULL,
	"warranty_period" text NOT NULL,
	"department" text NOT NULL,
	"department_ar" text,
	"status" text DEFAULT 'Operational' NOT NULL,
	"ip_address" text,
	"mac_address" text,
	"location" text,
	"assigned_employee" text,
	"department_history" jsonb DEFAULT '[]'::jsonb,
	"maintenance_history" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "electronic_devices_device_code_unique" UNIQUE("device_code")
);
--> statement-breakpoint
CREATE TABLE "role_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"action" text NOT NULL,
	"performed_by" text NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"permissions" text[] DEFAULT '{}' NOT NULL,
	"created_by" text,
	"is_deleted" boolean DEFAULT false,
	"deleted_at" timestamp,
	"deleted_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "support_teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_key" text NOT NULL,
	"name" text NOT NULL,
	"name_ar" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"description_ar" text,
	"member_user_ids" text[] DEFAULT '{}',
	"lead_user_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "support_teams_team_key_unique" UNIQUE("team_key")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"setting_key" text DEFAULT 'default' NOT NULL,
	"max_picture_attachments" integer DEFAULT 3,
	"max_attachment_size_bytes" integer DEFAULT 5242880,
	"max_attachment_size_mb" integer DEFAULT 5,
	"allowed_image_types" text[] DEFAULT '{"image/jpeg","image/png"}',
	"sla_critical_hours" integer DEFAULT 4,
	"sla_medium_hours" integer DEFAULT 24,
	"sla_low_hours" integer DEFAULT 48,
	"serilog_api_url" text,
	"serilog_api_key" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "system_settings_setting_key_unique" UNIQUE("setting_key")
);
--> statement-breakpoint
CREATE TABLE "ticket_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"ticket_no" text,
	"file_name" text NOT NULL,
	"file_size" text NOT NULL,
	"file_type" text NOT NULL,
	"data_url" text,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ticket_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"ticket_no" text,
	"author_id" text NOT NULL,
	"author_name" text DEFAULT 'Support Agent' NOT NULL,
	"author_role" text DEFAULT 'Employee',
	"author_user_type" text DEFAULT 'Operational User',
	"author_email" text DEFAULT '',
	"content" text NOT NULL,
	"is_internal" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ticket_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"ticket_no" text,
	"actor_id" text,
	"actor_name" text NOT NULL,
	"actor_role" text DEFAULT 'Employee',
	"actor_user_type" text DEFAULT 'Operational User',
	"action" text NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_no" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"ticket_type" text DEFAULT 'Hardware Maintenance' NOT NULL,
	"assigned_team" text DEFAULT 'Technical Team' NOT NULL,
	"team_id" text,
	"hardware_device_type" text,
	"target_system" text,
	"user_request_action" text,
	"priority_stars" integer DEFAULT 2 NOT NULL,
	"priority" text DEFAULT 'Medium' NOT NULL,
	"stage" text DEFAULT 'New' NOT NULL,
	"status" text DEFAULT 'Open' NOT NULL,
	"category" text DEFAULT 'Hardware & Devices' NOT NULL,
	"department" text DEFAULT 'IT Service Desk' NOT NULL,
	"created_by" text,
	"assigned_to" text,
	"requester_id" text NOT NULL,
	"requester_name" text NOT NULL,
	"requester_email" text NOT NULL,
	"requester_dept" text DEFAULT 'IT Service Desk',
	"requester_user_type" text DEFAULT 'Operational User',
	"assignee_id" text,
	"assignee_name" text,
	"assignee_role" text,
	"response_sla_minutes" integer DEFAULT 240,
	"resolution_sla_minutes" integer DEFAULT 1440,
	"response_due_at" timestamp,
	"resolution_due_at" timestamp,
	"is_response_breached" boolean DEFAULT false,
	"is_resolution_breached" boolean DEFAULT false,
	"responded_at" timestamp,
	"resolved_at" timestamp,
	"closed_at" timestamp,
	"dept_request" text,
	"user_request_details" text,
	"hardware_details" text,
	"tags" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_uid" text NOT NULL,
	"user_email" text NOT NULL,
	"device_info" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"last_activity_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true,
	"invalidation_reason" text,
	CONSTRAINT "user_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"user_name" text,
	"email" text NOT NULL,
	"email_confirmed" boolean DEFAULT false,
	"full_name" text NOT NULL,
	"department" text,
	"job_title" text,
	"role" text DEFAULT 'Employee' NOT NULL,
	"user_type" text DEFAULT 'Operator',
	"failed_access_count" integer DEFAULT 0,
	"lockout_end" text,
	"is_locked_out" boolean DEFAULT false,
	"lockout_count" integer DEFAULT 0,
	"must_change_password" boolean DEFAULT false,
	"two_factor_enabled" boolean DEFAULT false,
	"two_factor_secret" text,
	"password_hash" text,
	"password_min_length" integer DEFAULT 8,
	"password_require_special" boolean DEFAULT false,
	"password_require_number" boolean DEFAULT false,
	"password_require_uppercase" boolean DEFAULT false,
	"password_require_lowercase" boolean DEFAULT false,
	"password_last_changed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"last_active_at" timestamp DEFAULT now(),
	"avatar_color" text,
	"phone" text,
	CONSTRAINT "users_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_departments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_manager_id_users_uid_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("uid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_audit_logs" ADD CONSTRAINT "role_audit_logs_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_audit_logs" ADD CONSTRAINT "role_audit_logs_performed_by_users_uid_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("uid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_created_by_users_uid_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("uid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_deleted_by_users_uid_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("uid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;