CREATE TABLE team_days_new (
  id TEXT PRIMARY KEY NOT NULL,
  team TEXT NOT NULL,
  month TEXT NOT NULL,
  day TEXT NOT NULL,
  site TEXT NOT NULL,
  updated TEXT NOT NULL
);

INSERT INTO team_days_new (id, team, month, day, site, updated)
SELECT lower(hex(randomblob(16))), team, month, day, site, updated
FROM team_days;

DROP TABLE team_days;
ALTER TABLE team_days_new RENAME TO team_days;
CREATE UNIQUE INDEX team_days_team_day ON team_days(team, day);
CREATE INDEX team_days_day ON team_days(day);
