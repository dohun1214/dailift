CREATE TABLE `workout_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT 1 NOT NULL,
	`workout_id` text NOT NULL,
	`path` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workout_photos_workout_idx` ON `workout_photos` (`workout_id`);