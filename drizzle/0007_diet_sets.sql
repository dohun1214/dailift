CREATE TABLE `food_set_items` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT 1 NOT NULL,
	`set_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`src` text NOT NULL,
	`sid` text NOT NULL,
	`name` text NOT NULL,
	`grams` real NOT NULL,
	`unit_grams` real,
	`unit_name` text,
	`basis` text DEFAULT 'g' NOT NULL,
	`kcal` real DEFAULT 0 NOT NULL,
	`protein` real DEFAULT 0 NOT NULL,
	`carb` real DEFAULT 0 NOT NULL,
	`fat` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `food_set_items_set_idx` ON `food_set_items` (`set_id`,`position`);--> statement-breakpoint
CREATE TABLE `food_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL
);
