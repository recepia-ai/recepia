-- ---------------------------------------------------------------------------
-- Make tool_invocations.conversation_id nullable.
--
-- conversation_id is NOT NULL in the initial schema, but tool invocations can
-- happen outside of an active conversation (e.g. from test pages or admin
-- tools). Dropping the NOT NULL constraint allows these invocations to be
-- recorded without a conversation bound to them.
-- ---------------------------------------------------------------------------

ALTER TABLE tool_invocations
  ALTER COLUMN conversation_id DROP NOT NULL;
