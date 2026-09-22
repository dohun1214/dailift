ALTER TABLE `workout_exercises` ADD `rep_min` integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE `workout_exercises` ADD `rep_max` integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE `workout_exercises` ADD `increment` real DEFAULT 2.5 NOT NULL;--> statement-breakpoint
ALTER TABLE `workout_exercises` ADD `increment_unit` text DEFAULT 'kg' NOT NULL;