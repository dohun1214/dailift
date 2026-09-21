CREATE TABLE `body_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT 1 NOT NULL,
	`measured_at` integer NOT NULL,
	`weight` real,
	`weight_unit` text DEFAULT 'kg' NOT NULL,
	`skeletal_muscle` real,
	`body_fat_pct` real,
	`source` text DEFAULT 'manual' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `body_metrics_measured_idx` ON `body_metrics` (`measured_at`);--> statement-breakpoint
CREATE TABLE `exercise_muscles` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT 1 NOT NULL,
	`exercise_id` text NOT NULL,
	`muscle_id` text NOT NULL,
	`role` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exercise_muscles_pair_idx` ON `exercise_muscles` (`exercise_id`,`muscle_id`);--> statement-breakpoint
CREATE INDEX `exercise_muscles_muscle_idx` ON `exercise_muscles` (`muscle_id`);--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT 1 NOT NULL,
	`is_custom` integer DEFAULT 1 NOT NULL,
	`name_ko` text,
	`name_en` text,
	`name` text,
	`type` text NOT NULL,
	`equipment` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `exercises_custom_idx` ON `exercises` (`is_custom`,`sort_order`);--> statement-breakpoint
CREATE TABLE `muscles` (
	`id` text PRIMARY KEY NOT NULL,
	`group` text NOT NULL,
	`name_ko` text NOT NULL,
	`name_en` text NOT NULL,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `routine_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT 1 NOT NULL,
	`routine_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`target_sets` integer DEFAULT 3 NOT NULL,
	`rep_min` integer DEFAULT 8 NOT NULL,
	`rep_max` integer DEFAULT 12 NOT NULL,
	`rest_sec` integer DEFAULT 90 NOT NULL,
	`increment` real DEFAULT 2.5 NOT NULL,
	`increment_unit` text DEFAULT 'kg' NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE INDEX `routine_exercises_routine_idx` ON `routine_exercises` (`routine_id`,`position`);--> statement-breakpoint
CREATE TABLE `routine_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`rotation_mode` integer DEFAULT 0 NOT NULL,
	`rotation_index` integer DEFAULT 0 NOT NULL,
	`template_key` text,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `routines` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT 1 NOT NULL,
	`group_id` text,
	`name` text NOT NULL,
	`weekdays` integer DEFAULT 0 NOT NULL,
	`reminder_time` text,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `routines_group_idx` ON `routines` (`group_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `sets` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT 1 NOT NULL,
	`workout_exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`kind` text DEFAULT 'working' NOT NULL,
	`weight` real,
	`weight_unit` text DEFAULT 'kg' NOT NULL,
	`reps` integer,
	`duration_sec` integer,
	`rpe` real,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `sets_workout_exercise_idx` ON `sets` (`workout_exercise_id`,`position`);--> statement-breakpoint
CREATE INDEX `sets_completed_idx` ON `sets` (`completed_at`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`table_name` text PRIMARY KEY NOT NULL,
	`cursor_updated_at` integer DEFAULT 0 NOT NULL,
	`cursor_id` text DEFAULT '' NOT NULL,
	`last_synced_at` integer
);
--> statement-breakpoint
CREATE TABLE `workout_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT 1 NOT NULL,
	`workout_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`rest_sec` integer DEFAULT 90 NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE INDEX `workout_exercises_workout_idx` ON `workout_exercises` (`workout_id`,`position`);--> statement-breakpoint
CREATE INDEX `workout_exercises_exercise_idx` ON `workout_exercises` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT 1 NOT NULL,
	`routine_id` text,
	`name` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`note` text
);
--> statement-breakpoint
CREATE INDEX `workouts_started_idx` ON `workouts` (`started_at`);--> statement-breakpoint
CREATE INDEX `workouts_status_idx` ON `workouts` (`status`);