CREATE TABLE `supplement_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT 1 NOT NULL,
	`supplement_id` text NOT NULL,
	`date` text NOT NULL,
	`taken_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `supplement_logs_date_idx` ON `supplement_logs` (`date`,`supplement_id`);--> statement-breakpoint
CREATE TABLE `supplements` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`dose` text,
	`timing` text DEFAULT 'time' NOT NULL,
	`time_min` integer DEFAULT 540 NOT NULL,
	`after_min` integer DEFAULT 30 NOT NULL,
	`notify` integer DEFAULT 1 NOT NULL,
	`renotify` integer DEFAULT 1 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
