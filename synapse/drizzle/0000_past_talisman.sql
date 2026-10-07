CREATE TABLE `datapoints` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`Lat` real NOT NULL,
	`Long` real NOT NULL,
	`terrain` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `packets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`desc` text NOT NULL,
	`time` text NOT NULL,
	`details` text NOT NULL
);
