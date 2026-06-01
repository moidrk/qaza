CREATE TABLE "pending_registration" (
	"email" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"passwordHash" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "pending_registration_expires_at_idx" ON "pending_registration" USING btree ("expiresAt");