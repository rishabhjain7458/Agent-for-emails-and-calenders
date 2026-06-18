ALTER TABLE connected_accounts DROP CONSTRAINT IF EXISTS connected_accounts_provider_check;
ALTER TABLE connected_accounts
  ADD CONSTRAINT connected_accounts_provider_check
  CHECK (provider IN ('google', 'microsoft', 'zoho', 'imap'));
