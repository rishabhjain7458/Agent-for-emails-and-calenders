ALTER TABLE settings ALTER COLUMN timezone SET DEFAULT 'Asia/Kolkata';

UPDATE settings
SET timezone = 'Asia/Kolkata', updated_at = NOW()
WHERE timezone = 'UTC';
