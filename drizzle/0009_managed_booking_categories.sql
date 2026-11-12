CREATE TABLE booking_categories (
 id TEXT PRIMARY KEY NOT NULL,
 label TEXT NOT NULL,
 short_label TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('office','attendance','vacation','absence','dayoff','special')),
 color TEXT NOT NULL DEFAULT '#607d8b',
 sort_order INTEGER NOT NULL DEFAULT 100,
 created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO booking_categories (id,label,short_label,kind,color,sort_order) VALUES
 ('wecker','Wecker','WE','office','#4f8c76',10),
 ('strassen','Strassen','ST','office','#507cca',20),
 ('frankfurt','Frankfurt','FF','office','#a267b5',30),
 ('home','Home Office','HO','attendance','#8c78b5',40),
 ('vacation','Urlaub','UR','vacation','#d5a84e',50),
 ('training','Schulung','SC','attendance','#4f91a1',60),
 ('free','Free Zone','FZ','special','#b38dab',70),
 ('off','Dienstfrei','DF','dayoff','#8391a0',80),
 ('sick','Krankheit','KR','absence','#85939b',90),
 ('absent','Abwesend','AB','absence','#85939b',100);

CREATE TABLE category_capacities (
 category_id TEXT NOT NULL REFERENCES booking_categories(id) ON DELETE CASCADE,
 effective TEXT NOT NULL,
 places INTEGER NOT NULL CHECK(places BETWEEN 0 AND 100),
 mode TEXT NOT NULL CHECK(mode IN ('block','warn')),
 PRIMARY KEY(category_id,effective)
);

INSERT INTO category_capacities(category_id,effective,places,mode)
 SELECT 'wecker',effective,wecker,mode FROM capacities;
INSERT INTO category_capacities(category_id,effective,places,mode)
 SELECT 'strassen',effective,strassen,mode FROM capacities;
INSERT INTO category_capacities(category_id,effective,places,mode)
 SELECT 'frankfurt',effective,0,mode FROM capacities;
INSERT OR IGNORE INTO category_capacities(category_id,effective,places,mode) VALUES
 ('wecker','2000-01-01',6,'block'),
 ('strassen','2000-01-01',6,'block'),
 ('frankfurt','2000-01-01',0,'block');

CREATE TRIGGER booking_status_insert BEFORE INSERT ON bookings
 WHEN NOT EXISTS(SELECT 1 FROM booking_categories c WHERE c.id=NEW.status)
 BEGIN SELECT RAISE(ABORT,'INVALID_STATUS'); END;
CREATE TRIGGER booking_status_update BEFORE UPDATE ON bookings
 WHEN NOT EXISTS(SELECT 1 FROM booking_categories c WHERE c.id=NEW.status)
 BEGIN SELECT RAISE(ABORT,'INVALID_STATUS'); END;

DROP TRIGGER booking_capacity_insert;
DROP TRIGGER booking_capacity_update;
CREATE TRIGGER booking_capacity_insert BEFORE INSERT ON bookings
 WHEN EXISTS(SELECT 1 FROM booking_categories c WHERE c.id=NEW.status AND c.kind='office')
 AND COALESCE((SELECT cc.mode FROM category_capacities cc WHERE cc.category_id=NEW.status AND cc.effective<=NEW.day ORDER BY cc.effective DESC LIMIT 1),'block')='block'
 AND (SELECT COUNT(*) FROM bookings WHERE day=NEW.day AND status=NEW.status AND user_id<>NEW.user_id)>=COALESCE((SELECT cc.places FROM category_capacities cc WHERE cc.category_id=NEW.status AND cc.effective<=NEW.day ORDER BY cc.effective DESC LIMIT 1),0)
 BEGIN SELECT RAISE(ABORT,'CAPACITY_FULL'); END;
CREATE TRIGGER booking_capacity_update BEFORE UPDATE ON bookings
 WHEN EXISTS(SELECT 1 FROM booking_categories c WHERE c.id=NEW.status AND c.kind='office')
 AND COALESCE((SELECT cc.mode FROM category_capacities cc WHERE cc.category_id=NEW.status AND cc.effective<=NEW.day ORDER BY cc.effective DESC LIMIT 1),'block')='block'
 AND (SELECT COUNT(*) FROM bookings WHERE day=NEW.day AND status=NEW.status AND user_id<>NEW.user_id)>=COALESCE((SELECT cc.places FROM category_capacities cc WHERE cc.category_id=NEW.status AND cc.effective<=NEW.day ORDER BY cc.effective DESC LIMIT 1),0)
 BEGIN SELECT RAISE(ABORT,'CAPACITY_FULL'); END;

CREATE TRIGGER category_capacity_insert_guard BEFORE INSERT ON category_capacities
 WHEN NEW.mode='block' AND EXISTS(SELECT 1 FROM bookings b WHERE b.status=NEW.category_id AND b.day>=NEW.effective AND b.day<COALESCE((SELECT MIN(effective) FROM category_capacities WHERE category_id=NEW.category_id AND effective>NEW.effective),'9999-12-31') GROUP BY b.day HAVING COUNT(*)>NEW.places)
 BEGIN SELECT RAISE(ABORT,'CAPACITY_BELOW_BOOKINGS'); END;
CREATE TRIGGER category_capacity_update_guard BEFORE UPDATE ON category_capacities
 WHEN NEW.mode='block' AND EXISTS(SELECT 1 FROM bookings b WHERE b.status=NEW.category_id AND b.day>=NEW.effective AND b.day<COALESCE((SELECT MIN(effective) FROM category_capacities WHERE category_id=NEW.category_id AND effective>NEW.effective),'9999-12-31') GROUP BY b.day HAVING COUNT(*)>NEW.places)
 BEGIN SELECT RAISE(ABORT,'CAPACITY_BELOW_BOOKINGS'); END;

DROP TRIGGER holiday_capacity_guard;
CREATE TRIGGER holiday_capacity_guard BEFORE DELETE ON holidays
 WHEN EXISTS(SELECT b.status FROM bookings b JOIN booking_categories c ON c.id=b.status AND c.kind='office' WHERE b.day=OLD.day GROUP BY b.status
 HAVING COUNT(*)>COALESCE((SELECT cc.places FROM category_capacities cc WHERE cc.category_id=b.status AND cc.effective<=OLD.day ORDER BY cc.effective DESC LIMIT 1),0)
 AND COALESCE((SELECT cc.mode FROM category_capacities cc WHERE cc.category_id=b.status AND cc.effective<=OLD.day ORDER BY cc.effective DESC LIMIT 1),'block')='block')
 BEGIN SELECT RAISE(ABORT,'CAPACITY_BELOW_BOOKINGS'); END;

DROP TRIGGER vacation_limit_insert;
DROP TRIGGER vacation_limit_update;
DROP TRIGGER allowance_guard_insert;
DROP TRIGGER allowance_guard_update;
DROP TRIGGER holiday_removal_guard;
CREATE TRIGGER vacation_limit_insert BEFORE INSERT ON bookings
 WHEN EXISTS(SELECT 1 FROM booking_categories c WHERE c.id=NEW.status AND c.kind='vacation') AND NEW.day NOT IN (SELECT day FROM holidays)
 AND (SELECT COUNT(*) FROM bookings b JOIN booking_categories c ON c.id=b.status AND c.kind='vacation' WHERE b.user_id=NEW.user_id AND substr(b.day,1,4)=substr(NEW.day,1,4) AND b.day<>NEW.day AND b.day NOT IN (SELECT day FROM holidays) AND strftime('%w',b.day) NOT IN ('0','6')) >= COALESCE((SELECT days FROM allowances WHERE user_id=NEW.user_id AND year=CAST(substr(NEW.day,1,4) AS INTEGER)),0)
 BEGIN SELECT RAISE(ABORT,'VACATION_LIMIT'); END;
CREATE TRIGGER vacation_limit_update BEFORE UPDATE ON bookings
 WHEN EXISTS(SELECT 1 FROM booking_categories c WHERE c.id=NEW.status AND c.kind='vacation') AND NEW.day NOT IN (SELECT day FROM holidays)
 AND (SELECT COUNT(*) FROM bookings b JOIN booking_categories c ON c.id=b.status AND c.kind='vacation' WHERE b.user_id=NEW.user_id AND substr(b.day,1,4)=substr(NEW.day,1,4) AND b.day<>NEW.day AND b.rowid<>OLD.rowid AND b.day NOT IN (SELECT day FROM holidays) AND strftime('%w',b.day) NOT IN ('0','6')) >= COALESCE((SELECT days FROM allowances WHERE user_id=NEW.user_id AND year=CAST(substr(NEW.day,1,4) AS INTEGER)),0)
 BEGIN SELECT RAISE(ABORT,'VACATION_LIMIT'); END;
CREATE TRIGGER allowance_guard_insert BEFORE INSERT ON allowances
 WHEN NEW.days < (SELECT COUNT(*) FROM bookings b JOIN booking_categories c ON c.id=b.status AND c.kind='vacation' WHERE b.user_id=NEW.user_id AND CAST(substr(b.day,1,4) AS INTEGER)=NEW.year AND b.day NOT IN (SELECT day FROM holidays) AND strftime('%w',b.day) NOT IN ('0','6'))
 BEGIN SELECT RAISE(ABORT,'ALLOWANCE_BELOW_BOOKINGS'); END;
CREATE TRIGGER allowance_guard_update BEFORE UPDATE ON allowances
 WHEN NEW.days < (SELECT COUNT(*) FROM bookings b JOIN booking_categories c ON c.id=b.status AND c.kind='vacation' WHERE b.user_id=NEW.user_id AND CAST(substr(b.day,1,4) AS INTEGER)=NEW.year AND b.day NOT IN (SELECT day FROM holidays) AND strftime('%w',b.day) NOT IN ('0','6'))
 BEGIN SELECT RAISE(ABORT,'ALLOWANCE_BELOW_BOOKINGS'); END;
CREATE TRIGGER holiday_removal_guard BEFORE DELETE ON holidays
 WHEN strftime('%w',OLD.day) NOT IN ('0','6') AND EXISTS(
 SELECT b.user_id FROM bookings b JOIN booking_categories c ON c.id=b.status AND c.kind='vacation' WHERE b.day=OLD.day AND
 (SELECT COUNT(*) FROM bookings v JOIN booking_categories vc ON vc.id=v.status AND vc.kind='vacation' WHERE v.user_id=b.user_id AND substr(v.day,1,4)=substr(OLD.day,1,4) AND strftime('%w',v.day) NOT IN ('0','6') AND (v.day=OLD.day OR v.day NOT IN (SELECT day FROM holidays))) > COALESCE((SELECT days FROM allowances WHERE user_id=b.user_id AND year=CAST(substr(OLD.day,1,4) AS INTEGER)),0))
 BEGIN SELECT RAISE(ABORT,'HOLIDAY_REMOVE_LIMIT'); END;
