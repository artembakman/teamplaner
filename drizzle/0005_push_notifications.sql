CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);
CREATE INDEX push_subscriptions_user ON push_subscriptions(user_id);
CREATE TABLE push_preferences (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 0,
  updated TEXT NOT NULL
);
CREATE TABLE notifications (
  id TEXT PRIMARY KEY NOT NULL,
  event_key TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_by TEXT REFERENCES members(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '/',
  created TEXT NOT NULL,
  read_at TEXT,
  UNIQUE(event_key, user_id)
);
CREATE INDEX notifications_user_created ON notifications(user_id, created DESC);
CREATE TABLE notification_deliveries (
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  subscription_id TEXT NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(notification_id, subscription_id)
);
CREATE INDEX notification_deliveries_due ON notification_deliveries(status, next_attempt);
CREATE TABLE push_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
