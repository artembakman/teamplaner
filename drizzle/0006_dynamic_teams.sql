CREATE TABLE teams (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_system INTEGER NOT NULL DEFAULT 0,
  is_assignable INTEGER NOT NULL DEFAULT 1
);
--> statement-breakpoint
INSERT INTO teams (id,name,color,sort_order,is_system,is_assignable) VALUES
  ('nostro','Nostro','#5579c1',10,0,1),
  ('wp','WP-Stammdaten','#5d9a6b',20,0,1),
  ('lagerstellen','Lagerstellen','#d0a737',30,0,1),
  ('networks','Networks','#c46c65',40,0,1),
  ('leitung','Gruppenleitung','#718b90',90,1,1),
  ('open','Team offen','#849198',100,1,0);
