ALTER TABLE `sets` ADD `distance` real;--> statement-breakpoint
ALTER TABLE `sets` ADD `distance_unit` text DEFAULT 'km' NOT NULL;--> statement-breakpoint
ALTER TABLE `sets` ADD `speed` real;--> statement-breakpoint
ALTER TABLE `sets` ADD `incline` real;