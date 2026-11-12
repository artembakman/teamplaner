INSERT INTO booking_categories (id,label,short_label,kind,color,sort_order)
VALUES ('feiertagsarbeit','Feiertagsarbeit','FA','attendance','#ad693e',65);

DROP TRIGGER non_working_insert;
CREATE TRIGGER non_working_insert BEFORE INSERT ON bookings
 WHEN ((NEW.day IN (SELECT day FROM holidays) OR strftime('%w',NEW.day) IN ('0','6')) AND NEW.status<>'feiertagsarbeit')
 OR (NEW.status='feiertagsarbeit' AND NEW.day NOT IN (SELECT day FROM holidays))
 BEGIN SELECT RAISE(ABORT,'NON_WORKING_DAY'); END;

DROP TRIGGER non_working_update;
CREATE TRIGGER non_working_update BEFORE UPDATE ON bookings
 WHEN (((NEW.day IN (SELECT day FROM holidays) OR strftime('%w',NEW.day) IN ('0','6')) AND NEW.status<>'feiertagsarbeit')
   AND NOT (NEW.day=OLD.day AND NEW.user_id=OLD.user_id AND NEW.status='absent' AND OLD.status IN ('sick','vacation','off')))
 OR (NEW.status='feiertagsarbeit' AND NEW.day NOT IN (SELECT day FROM holidays))
 BEGIN SELECT RAISE(ABORT,'NON_WORKING_DAY'); END;

CREATE TRIGGER holiday_work_delete_guard BEFORE DELETE ON holidays
 WHEN EXISTS(SELECT 1 FROM bookings WHERE day=OLD.day AND status='feiertagsarbeit')
 BEGIN SELECT RAISE(ABORT,'HOLIDAY_WORK_BOOKED'); END;
