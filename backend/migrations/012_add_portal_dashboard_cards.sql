ALTER TABLE dashboard_cards
  DROP CONSTRAINT IF EXISTS dashboard_cards_card_type_check;

ALTER TABLE dashboard_cards
  ADD CONSTRAINT dashboard_cards_card_type_check
  CHECK (card_type IN ('social', 'news', 'custom_link', 'portal'));
