CREATE TABLE `bookings` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`status` text NOT NULL,
	`updated` text NOT NULL,
	PRIMARY KEY(`user_id`, `day`),
	FOREIGN KEY (`user_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bookings_day_status` ON `bookings` (`day`,`status`);--> statement-breakpoint
CREATE TABLE `capacities` (
	`effective` text PRIMARY KEY NOT NULL,
	`wecker` integer NOT NULL,
	`strassen` integer NOT NULL,
	`mode` text DEFAULT 'block' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`alias` text NOT NULL,
	`role` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_alias_unique` ON `members` (`alias`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`invite` text NOT NULL,
	`training` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER booking_capacity_insert BEFORE INSERT ON bookings
WHEN NEW.status IN ('wecker','strassen')
AND COALESCE((SELECT mode FROM capacities WHERE effective<=NEW.day ORDER BY effective DESC LIMIT 1),'block')='block'
AND (SELECT COUNT(*) FROM bookings WHERE day=NEW.day AND status=NEW.status AND user_id<>NEW.user_id)>=COALESCE((SELECT CASE NEW.status WHEN 'wecker' THEN wecker ELSE strassen END FROM capacities WHERE effective<=NEW.day ORDER BY effective DESC LIMIT 1),6)
BEGIN SELECT RAISE(ABORT,'CAPACITY_FULL'); END;
--> statement-breakpoint
CREATE TRIGGER booking_capacity_update BEFORE UPDATE ON bookings
WHEN NEW.status IN ('wecker','strassen')
AND COALESCE((SELECT mode FROM capacities WHERE effective<=NEW.day ORDER BY effective DESC LIMIT 1),'block')='block'
AND (SELECT COUNT(*) FROM bookings WHERE day=NEW.day AND status=NEW.status AND user_id<>NEW.user_id)>=COALESCE((SELECT CASE NEW.status WHEN 'wecker' THEN wecker ELSE strassen END FROM capacities WHERE effective<=NEW.day ORDER BY effective DESC LIMIT 1),6)
BEGIN SELECT RAISE(ABORT,'CAPACITY_FULL'); END;
--> statement-breakpoint
CREATE TRIGGER capacity_insert_guard BEFORE INSERT ON capacities
WHEN NEW.mode='block' AND EXISTS(SELECT day,status FROM bookings WHERE day>=NEW.effective AND day<COALESCE((SELECT MIN(effective) FROM capacities WHERE effective>NEW.effective),'9999-12-31') AND status IN ('wecker','strassen') GROUP BY day,status HAVING COUNT(*)>CASE status WHEN 'wecker' THEN NEW.wecker ELSE NEW.strassen END)
BEGIN SELECT RAISE(ABORT,'CAPACITY_BELOW_BOOKINGS'); END;
--> statement-breakpoint
CREATE TRIGGER capacity_update_guard BEFORE UPDATE ON capacities
WHEN NEW.mode='block' AND EXISTS(SELECT day,status FROM bookings WHERE day>=NEW.effective AND day<COALESCE((SELECT MIN(effective) FROM capacities WHERE effective>NEW.effective),'9999-12-31') AND status IN ('wecker','strassen') GROUP BY day,status HAVING COUNT(*)>CASE status WHEN 'wecker' THEN NEW.wecker ELSE NEW.strassen END)
BEGIN SELECT RAISE(ABORT,'CAPACITY_BELOW_BOOKINGS'); END;
