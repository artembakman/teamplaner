CREATE TABLE `attendees` (
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`event_id`, `user_id`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`creator` text NOT NULL,
	`title` text NOT NULL,
	`day` text NOT NULL,
	`time` text NOT NULL,
	`site` text NOT NULL,
	FOREIGN KEY (`creator`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `team_days` (
	`team` text NOT NULL,
	`month` text NOT NULL,
	`day` text NOT NULL,
	`site` text NOT NULL,
	`updated` text NOT NULL,
	PRIMARY KEY(`team`, `month`)
);
--> statement-breakpoint
ALTER TABLE `members` ADD `team` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `icon` text DEFAULT '🙂' NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `birthday` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `birthday_reminders` integer DEFAULT 1 NOT NULL;