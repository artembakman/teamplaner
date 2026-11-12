CREATE TABLE `allowances` (
	`user_id` text NOT NULL,
	`year` integer NOT NULL,
	`days` integer NOT NULL,
	PRIMARY KEY(`user_id`, `year`),
	FOREIGN KEY (`user_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `members` ADD `birthday` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `birthday_reminders` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
DROP TRIGGER booking_status_insert;
--> statement-breakpoint
DROP TRIGGER booking_status_update;
--> statement-breakpoint
DROP TRIGGER non_working_update;

--> statement-breakpoint
CREATE TRIGGER vacation_limit_insert BEFORE INSERT ON bookings
 WHEN NEW.status='vacation' AND NEW.day NOT IN (SELECT day FROM holidays)
 AND (SELECT COUNT(*) FROM bookings b WHERE b.user_id=NEW.user_id AND b.status='vacation' AND substr(b.day,1,4)=substr(NEW.day,1,4) AND b.day<>NEW.day AND b.day NOT IN (SELECT day FROM holidays) AND strftime('%w',b.day) NOT IN ('0','6')) >= COALESCE((SELECT days FROM allowances WHERE user_id=NEW.user_id AND year=CAST(substr(NEW.day,1,4) AS INTEGER)),0)
 BEGIN SELECT RAISE(ABORT,'VACATION_LIMIT'); END;

--> statement-breakpoint
CREATE TRIGGER vacation_limit_update BEFORE UPDATE ON bookings
 WHEN NEW.status='vacation' AND NEW.day NOT IN (SELECT day FROM holidays)
 AND (SELECT COUNT(*) FROM bookings b WHERE b.user_id=NEW.user_id AND b.status='vacation' AND substr(b.day,1,4)=substr(NEW.day,1,4) AND b.day<>NEW.day AND b.day NOT IN (SELECT day FROM holidays) AND strftime('%w',b.day) NOT IN ('0','6')) >= COALESCE((SELECT days FROM allowances WHERE user_id=NEW.user_id AND year=CAST(substr(NEW.day,1,4) AS INTEGER)),0)
 BEGIN SELECT RAISE(ABORT,'VACATION_LIMIT'); END;

--> statement-breakpoint
CREATE TRIGGER allowance_guard_insert BEFORE INSERT ON allowances
 WHEN NEW.days < (SELECT COUNT(*) FROM bookings b WHERE b.user_id=NEW.user_id AND b.status='vacation' AND CAST(substr(b.day,1,4) AS INTEGER)=NEW.year AND b.day NOT IN (SELECT day FROM holidays) AND strftime('%w',b.day) NOT IN ('0','6'))
 BEGIN SELECT RAISE(ABORT,'ALLOWANCE_BELOW_BOOKINGS'); END;

--> statement-breakpoint
CREATE TRIGGER allowance_guard_update BEFORE UPDATE ON allowances
 WHEN NEW.days < (SELECT COUNT(*) FROM bookings b WHERE b.user_id=NEW.user_id AND b.status='vacation' AND CAST(substr(b.day,1,4) AS INTEGER)=NEW.year AND b.day NOT IN (SELECT day FROM holidays) AND strftime('%w',b.day) NOT IN ('0','6'))
 BEGIN SELECT RAISE(ABORT,'ALLOWANCE_BELOW_BOOKINGS'); END;

--> statement-breakpoint
CREATE TRIGGER holiday_removal_guard BEFORE DELETE ON holidays
 WHEN strftime('%w',OLD.day) NOT IN ('0','6') AND EXISTS(
 SELECT b.user_id FROM bookings b WHERE b.status='vacation' AND b.day=OLD.day AND
 (SELECT COUNT(*) FROM bookings v WHERE v.user_id=b.user_id AND v.status='vacation' AND substr(v.day,1,4)=substr(OLD.day,1,4) AND strftime('%w',v.day) NOT IN ('0','6') AND (v.day=OLD.day OR v.day NOT IN (SELECT day FROM holidays))) > COALESCE((SELECT days FROM allowances WHERE user_id=b.user_id AND year=CAST(substr(OLD.day,1,4) AS INTEGER)),0))
 BEGIN SELECT RAISE(ABORT,'HOLIDAY_REMOVE_LIMIT'); END;

--> statement-breakpoint
CREATE TRIGGER non_working_update BEFORE UPDATE ON bookings
 WHEN NEW.day IN (SELECT day FROM holidays) OR strftime('%w',NEW.day) IN ('0','6')
 BEGIN SELECT RAISE(ABORT,'NON_WORKING_DAY'); END;
