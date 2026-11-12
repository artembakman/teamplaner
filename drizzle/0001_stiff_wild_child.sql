CREATE TABLE `allowances` (
	`user_id` text NOT NULL,
	`year` integer NOT NULL,
	`days` integer NOT NULL,
	PRIMARY KEY(`user_id`, `year`),
	FOREIGN KEY (`user_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `holidays` (
	`day` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quota_rules` (
	`month` text PRIMARY KEY NOT NULL,
	`limit_percent` integer NOT NULL
);

--> statement-breakpoint
CREATE TRIGGER vacation_limit_insert BEFORE INSERT ON bookings
 WHEN NEW.status='vacation' AND NEW.day NOT IN (SELECT day FROM holidays)
 AND (SELECT COUNT(*) FROM bookings b WHERE b.user_id=NEW.user_id AND b.status='vacation' AND substr(b.day,1,4)=substr(NEW.day,1,4) AND b.day<>NEW.day AND b.day NOT IN (SELECT day FROM holidays) AND strftime('%w',b.day) NOT IN ('0','6')) >= COALESCE((SELECT days FROM allowances WHERE user_id=NEW.user_id AND year=CAST(substr(NEW.day,1,4) AS INTEGER)),0)
 BEGIN SELECT RAISE(ABORT,'VACATION_LIMIT'); END;

--> statement-breakpoint
CREATE TRIGGER non_working_insert BEFORE INSERT ON bookings
 WHEN NEW.day IN (SELECT day FROM holidays) OR strftime('%w',NEW.day) IN ('0','6')
 BEGIN SELECT RAISE(ABORT,'NON_WORKING_DAY'); END;

--> statement-breakpoint
CREATE TRIGGER allowance_guard_insert BEFORE INSERT ON allowances
 WHEN NEW.days < (SELECT COUNT(*) FROM bookings b WHERE b.user_id=NEW.user_id AND b.status='vacation' AND CAST(substr(b.day,1,4) AS INTEGER)=NEW.year AND b.day NOT IN (SELECT day FROM holidays) AND strftime('%w',b.day) NOT IN ('0','6'))
 BEGIN SELECT RAISE(ABORT,'ALLOWANCE_BELOW_BOOKINGS'); END;

--> statement-breakpoint
CREATE TRIGGER vacation_limit_update BEFORE UPDATE ON bookings
 WHEN NEW.status='vacation' AND NEW.day NOT IN (SELECT day FROM holidays)
 AND (SELECT COUNT(*) FROM bookings b WHERE b.user_id=NEW.user_id AND b.status='vacation' AND substr(b.day,1,4)=substr(NEW.day,1,4) AND b.day<>NEW.day AND b.day NOT IN (SELECT day FROM holidays) AND strftime('%w',b.day) NOT IN ('0','6')) >= COALESCE((SELECT days FROM allowances WHERE user_id=NEW.user_id AND year=CAST(substr(NEW.day,1,4) AS INTEGER)),0)
 BEGIN SELECT RAISE(ABORT,'VACATION_LIMIT'); END;

--> statement-breakpoint
CREATE TRIGGER non_working_update BEFORE UPDATE ON bookings
 WHEN NEW.day IN (SELECT day FROM holidays) OR strftime('%w',NEW.day) IN ('0','6')
 BEGIN SELECT RAISE(ABORT,'NON_WORKING_DAY'); END;

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
DROP TRIGGER capacity_insert_guard;

--> statement-breakpoint
CREATE TRIGGER capacity_insert_guard BEFORE INSERT ON capacities
WHEN NEW.mode='block' AND EXISTS(SELECT day,status FROM bookings WHERE day NOT IN (SELECT day FROM holidays) AND strftime('%w',day) NOT IN ('0','6') AND day>=NEW.effective AND day<COALESCE((SELECT MIN(effective) FROM capacities WHERE effective>NEW.effective),'9999-12-31') AND status IN ('wecker','strassen') GROUP BY day,status HAVING COUNT(*)>CASE status WHEN 'wecker' THEN NEW.wecker ELSE NEW.strassen END)
BEGIN SELECT RAISE(ABORT,'CAPACITY_BELOW_BOOKINGS'); END;

--> statement-breakpoint
DROP TRIGGER capacity_update_guard;

--> statement-breakpoint
CREATE TRIGGER capacity_update_guard BEFORE UPDATE ON capacities
WHEN NEW.mode='block' AND EXISTS(SELECT day,status FROM bookings WHERE day NOT IN (SELECT day FROM holidays) AND strftime('%w',day) NOT IN ('0','6') AND day>=NEW.effective AND day<COALESCE((SELECT MIN(effective) FROM capacities WHERE effective>NEW.effective),'9999-12-31') AND status IN ('wecker','strassen') GROUP BY day,status HAVING COUNT(*)>CASE status WHEN 'wecker' THEN NEW.wecker ELSE NEW.strassen END)
BEGIN SELECT RAISE(ABORT,'CAPACITY_BELOW_BOOKINGS'); END;

--> statement-breakpoint
CREATE TRIGGER holiday_capacity_guard BEFORE DELETE ON holidays
 WHEN COALESCE((SELECT mode FROM capacities WHERE effective<=OLD.day ORDER BY effective DESC LIMIT 1),'block')='block'
 AND EXISTS(SELECT status FROM bookings WHERE day=OLD.day AND status IN ('wecker','strassen') GROUP BY status HAVING COUNT(*) > COALESCE((SELECT CASE bookings.status WHEN 'wecker' THEN wecker ELSE strassen END FROM capacities WHERE effective<=OLD.day ORDER BY effective DESC LIMIT 1),6))
 BEGIN SELECT RAISE(ABORT,'CAPACITY_BELOW_BOOKINGS'); END;
