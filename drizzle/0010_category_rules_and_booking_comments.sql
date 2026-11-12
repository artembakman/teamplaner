ALTER TABLE booking_categories ADD COLUMN requires_capacity INTEGER NOT NULL DEFAULT 0 CHECK(requires_capacity IN (0,1));
ALTER TABLE booking_categories ADD COLUMN counts_for_attendance INTEGER NOT NULL DEFAULT 1 CHECK(counts_for_attendance IN (0,1));
ALTER TABLE booking_categories ADD COLUMN counts_for_wecker INTEGER NOT NULL DEFAULT 0 CHECK(counts_for_wecker IN (0,1));
ALTER TABLE bookings ADD COLUMN comment TEXT NOT NULL DEFAULT '';

UPDATE booking_categories SET kind='attendance',requires_capacity=1,counts_for_attendance=1 WHERE kind='office';
UPDATE booking_categories SET kind='attendance',requires_capacity=0,counts_for_attendance=1 WHERE kind='special';
UPDATE booking_categories SET kind='attendance',counts_for_attendance=COALESCE((SELECT training FROM settings WHERE id=1),0) WHERE id='training';
UPDATE booking_categories SET counts_for_attendance=0 WHERE kind IN ('vacation','absence','dayoff');
UPDATE booking_categories SET counts_for_wecker=1 WHERE id='wecker';

CREATE UNIQUE INDEX booking_categories_single_wecker_quota ON booking_categories(counts_for_wecker) WHERE counts_for_wecker=1;

DROP TRIGGER booking_capacity_insert;
DROP TRIGGER booking_capacity_update;
CREATE TRIGGER booking_capacity_insert BEFORE INSERT ON bookings
 WHEN EXISTS(SELECT 1 FROM booking_categories c WHERE c.id=NEW.status AND c.requires_capacity=1)
 AND COALESCE((SELECT cc.mode FROM category_capacities cc WHERE cc.category_id=NEW.status AND cc.effective<=NEW.day ORDER BY cc.effective DESC LIMIT 1),'block')='block'
 AND (SELECT COUNT(*) FROM bookings WHERE day=NEW.day AND status=NEW.status AND user_id<>NEW.user_id)>=COALESCE((SELECT cc.places FROM category_capacities cc WHERE cc.category_id=NEW.status AND cc.effective<=NEW.day ORDER BY cc.effective DESC LIMIT 1),0)
 BEGIN SELECT RAISE(ABORT,'CAPACITY_FULL'); END;
CREATE TRIGGER booking_capacity_update BEFORE UPDATE ON bookings
 WHEN EXISTS(SELECT 1 FROM booking_categories c WHERE c.id=NEW.status AND c.requires_capacity=1)
 AND COALESCE((SELECT cc.mode FROM category_capacities cc WHERE cc.category_id=NEW.status AND cc.effective<=NEW.day ORDER BY cc.effective DESC LIMIT 1),'block')='block'
 AND (SELECT COUNT(*) FROM bookings WHERE day=NEW.day AND status=NEW.status AND user_id<>NEW.user_id)>=COALESCE((SELECT cc.places FROM category_capacities cc WHERE cc.category_id=NEW.status AND cc.effective<=NEW.day ORDER BY cc.effective DESC LIMIT 1),0)
 BEGIN SELECT RAISE(ABORT,'CAPACITY_FULL'); END;

DROP TRIGGER holiday_capacity_guard;
CREATE TRIGGER holiday_capacity_guard BEFORE DELETE ON holidays
 WHEN EXISTS(SELECT b.status FROM bookings b JOIN booking_categories c ON c.id=b.status AND c.requires_capacity=1 WHERE b.day=OLD.day GROUP BY b.status
 HAVING COUNT(*)>COALESCE((SELECT cc.places FROM category_capacities cc WHERE cc.category_id=b.status AND cc.effective<=OLD.day ORDER BY cc.effective DESC LIMIT 1),0)
 AND COALESCE((SELECT cc.mode FROM category_capacities cc WHERE cc.category_id=b.status AND cc.effective<=OLD.day ORDER BY cc.effective DESC LIMIT 1),'block')='block')
 BEGIN SELECT RAISE(ABORT,'CAPACITY_BELOW_BOOKINGS'); END;
