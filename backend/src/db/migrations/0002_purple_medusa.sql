CREATE TABLE "idempotency_keys" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "idempotency_keys_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"agentId" integer NOT NULL,
	"key" varchar(255) NOT NULL,
	"requestHash" varchar(64) NOT NULL,
	"status" varchar(20) NOT NULL,
	"responseStatus" integer,
	"responseHeaders" text,
	"responseBody" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp,
	"expiresAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proxy_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "proxy_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"agentId" integer NOT NULL,
	"serviceId" integer NOT NULL,
	"idempotencyKeyId" integer,
	"method" varchar(10) NOT NULL,
	"targetUrl" varchar(2048) NOT NULL,
	"intent" varchar(500) NOT NULL,
	"requestedAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp,
	"statusCode" integer,
	"errorMessage" text
);
--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_agentId_agents_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proxy_requests" ADD CONSTRAINT "proxy_requests_agentId_agents_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proxy_requests" ADD CONSTRAINT "proxy_requests_serviceId_services_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proxy_requests" ADD CONSTRAINT "proxy_requests_idempotencyKeyId_idempotency_keys_id_fk" FOREIGN KEY ("idempotencyKeyId") REFERENCES "public"."idempotency_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_keys_agent_key_idx" ON "idempotency_keys" USING btree ("agentId","key");--> statement-breakpoint
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "proxy_requests_agent_id_idx" ON "proxy_requests" USING btree ("agentId");--> statement-breakpoint
CREATE INDEX "proxy_requests_service_id_idx" ON "proxy_requests" USING btree ("serviceId");--> statement-breakpoint
CREATE INDEX "proxy_requests_requested_at_idx" ON "proxy_requests" USING btree ("requestedAt");
