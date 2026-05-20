CREATE TABLE `endpoint_statuses` (
	`spec_id` text NOT NULL,
	`path` text NOT NULL,
	`method` text NOT NULL,
	`working` integer DEFAULT false NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	PRIMARY KEY(`spec_id`, `path`, `method`),
	FOREIGN KEY (`spec_id`) REFERENCES `specs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `spec_settings` (
	`spec_id` text PRIMARY KEY NOT NULL,
	`expanded_controllers_json` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`spec_id`) REFERENCES `specs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `spec_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`spec_id` text NOT NULL,
	`ts` integer NOT NULL,
	`version` text NOT NULL,
	`note` text,
	`summary_json` text,
	`is_restore` integer DEFAULT false,
	`snapshot_json` text NOT NULL,
	FOREIGN KEY (`spec_id`) REFERENCES `specs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spec_versions_spec_id_ts` ON `spec_versions` (`spec_id`,`ts`);--> statement-breakpoint
CREATE TABLE `specs` (
	`id` text PRIMARY KEY NOT NULL,
	`openapi_json` text NOT NULL,
	`updated_at` integer NOT NULL
);
