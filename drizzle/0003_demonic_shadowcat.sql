DROP TRIGGER vacation_limit_insert;
--> statement-breakpoint
DROP TRIGGER vacation_limit_update;
--> statement-breakpoint
DROP TRIGGER allowance_guard_insert;
--> statement-breakpoint
DROP TRIGGER allowance_guard_update;
--> statement-breakpoint
DROP TRIGGER holiday_removal_guard;
--> statement-breakpoint
DROP TRIGGER non_working_update;
--> statement-breakpoint
DROP TABLE `allowances`;--> statement-breakpoint
ALTER TABLE `members` DROP COLUMN `birthday`;--> statement-breakpoint
ALTER TABLE `members` DROP COLUMN `birthday_reminders`;
--> statement-breakpoint
CREATE TRIGGER non_working_update BEFORE UPDATE ON bookings
WHEN (NEW.day IN (SELECT day FROM holidays) OR strftime('%w',NEW.day) IN ('0','6'))
AND NOT (NEW.day=OLD.day AND NEW.user_id=OLD.user_id AND NEW.status='absent' AND OLD.status IN ('sick','vacation','off'))
BEGIN SELECT RAISE(ABORT,'NON_WORKING_DAY'); END;
--> statement-breakpoint
CREATE TRIGGER booking_status_insert BEFORE INSERT ON bookings
WHEN NEW.status NOT IN ('wecker','strassen','home','training','free','absent')
BEGIN SELECT RAISE(ABORT,'INVALID_STATUS'); END;
--> statement-breakpoint
CREATE TRIGGER booking_status_update BEFORE UPDATE ON bookings
WHEN NEW.status NOT IN ('wecker','strassen','home','training','free','absent')
BEGIN SELECT RAISE(ABORT,'INVALID_STATUS'); END;
