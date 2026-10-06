CREATE TABLE `food_favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT 1 NOT NULL,
	`src` text NOT NULL,
	`sid` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `food_favorites_food_idx` ON `food_favorites` (`src`,`sid`);--> statement-breakpoint
CREATE TABLE `food_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT 1 NOT NULL,
	`date` text NOT NULL,
	`meal` text NOT NULL,
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
CREATE INDEX `food_logs_date_idx` ON `food_logs` (`date`,`meal`,`position`);--> statement-breakpoint
CREATE TABLE `foods` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`serving` real,
	`serving_name` text,
	`kcal` real DEFAULT 0 NOT NULL,
	`protein` real DEFAULT 0 NOT NULL,
	`carb` real DEFAULT 0 NOT NULL,
	`fat` real DEFAULT 0 NOT NULL
);
