CREATE TABLE `food_cache` (
	`sid` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`maker` text DEFAULT '' NOT NULL,
	`basis` text DEFAULT 'g' NOT NULL,
	`kcal` real DEFAULT 0 NOT NULL,
	`protein` real DEFAULT 0 NOT NULL,
	`carb` real DEFAULT 0 NOT NULL,
	`fat` real DEFAULT 0 NOT NULL,
	`size` real,
	`serv` real,
	`fetched_at` integer NOT NULL
);
