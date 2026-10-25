CREATE TABLE `household_chunks` (
	`household_id` text NOT NULL,
	`position` integer NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`household_id`, `position`)
);
--> statement-breakpoint
CREATE TABLE `household_state` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`write_token` text DEFAULT '' NOT NULL,
	`updated_at` text,
	`updated_by` text
);
