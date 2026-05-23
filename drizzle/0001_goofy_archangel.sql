CREATE TABLE `endpoint_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`spec_id` text NOT NULL,
	`path` text NOT NULL,
	`method` text NOT NULL,
	`ts` integer NOT NULL,
	`kind` text DEFAULT 'note' NOT NULL,
	`body` text NOT NULL,
	FOREIGN KEY (`spec_id`) REFERENCES `specs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `endpoint_notes_lookup` ON `endpoint_notes` (`spec_id`,`path`,`method`,`ts`);