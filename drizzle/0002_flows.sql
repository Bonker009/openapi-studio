CREATE TABLE `flows` (
	`id` text PRIMARY KEY NOT NULL,
	`spec_id` text NOT NULL,
	`name` text NOT NULL,
	`flow_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`spec_id`) REFERENCES `specs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `flows_spec_id` ON `flows` (`spec_id`);
