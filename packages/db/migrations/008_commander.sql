-- Add keywords column to cards for commander eligibility (Partner, Choose a Background, etc.)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS keywords text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS cards_keywords_idx ON cards USING GIN(keywords);

-- Add is_commander flag to deck_cards
ALTER TABLE deck_cards ADD COLUMN IF NOT EXISTS is_commander boolean NOT NULL DEFAULT false;

-- Expand the primary key to include is_commander so the same card can appear as
-- both commander and a mainboard card (edge case: some formats allow it)
ALTER TABLE deck_cards DROP CONSTRAINT deck_cards_pkey;
ALTER TABLE deck_cards ADD PRIMARY KEY (deck_id, oracle_id, is_sideboard, is_commander);
