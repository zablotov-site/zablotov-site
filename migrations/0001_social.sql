CREATE TABLE IF NOT EXISTS social_profiles (id TEXT PRIMARY KEY, name TEXT NOT NULL, banned INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS social_likes (shiur TEXT NOT NULL, device TEXT NOT NULL REFERENCES social_profiles(id), created INTEGER NOT NULL, PRIMARY KEY(shiur,device));
CREATE TABLE IF NOT EXISTS social_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, shiur TEXT NOT NULL, device TEXT NOT NULL REFERENCES social_profiles(id), body TEXT NOT NULL, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS social_comments_shiur ON social_comments(shiur,id DESC);
CREATE INDEX IF NOT EXISTS social_comments_device ON social_comments(device);
CREATE TABLE IF NOT EXISTS social_limits (key TEXT PRIMARY KEY, window INTEGER NOT NULL, n INTEGER NOT NULL);
