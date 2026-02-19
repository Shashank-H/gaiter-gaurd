CREATE TABLE "approval_queue" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "approval_queue_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"actionId" varchar(36) NOT NULL,
	"agentId" integer NOT NULL,
	"serviceId" integer NOT NULL,
	"method" varchar(10) NOT NULL,
	"targetUrl" varchar(2048) NOT NULL,
	"requestHeaders" text,
	"requestBody" text,
	"intent" varchar(500) NOT NULL,
	"riskScore" real NOT NULL,
	"riskExplanation" text NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"approvalExpiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"resolvedAt" timestamp,
	"executedAt" timestamp,
	"responseStatus" integer,
	"responseHeaders" text,
	"responseBody" text,
	CONSTRAINT "approval_queue_actionId_unique" UNIQUE("actionId")
);
--> statement-breakpoint
ALTER TABLE "approval_queue" ADD CONSTRAINT "approval_queue_agentId_agents_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_queue" ADD CONSTRAINT "approval_queue_serviceId_services_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "approval_queue_action_id_idx" ON "approval_queue" USING btree ("actionId");--> statement-breakpoint
CREATE INDEX "approval_queue_agent_id_idx" ON "approval_queue" USING btree ("agentId");--> statement-breakpoint
CREATE INDEX "approval_queue_status_idx" ON "approval_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "approval_queue_created_at_idx" ON "approval_queue" USING btree ("createdAt");
