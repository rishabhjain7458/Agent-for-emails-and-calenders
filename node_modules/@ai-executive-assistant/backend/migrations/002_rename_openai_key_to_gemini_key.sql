DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'settings'
      AND column_name = 'openai_api_key'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'settings'
      AND column_name = 'gemini_api_key'
  ) THEN
    ALTER TABLE settings RENAME COLUMN openai_api_key TO gemini_api_key;
  END IF;
END $$;
