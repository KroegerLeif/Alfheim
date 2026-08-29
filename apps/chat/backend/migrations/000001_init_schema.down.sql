-- Down migration for alfheim chat-backend

DROP INDEX IF EXISTS idx_image_refs_message;
DROP INDEX IF EXISTS idx_messages_conversation;
DROP INDEX IF EXISTS idx_conversations_household;
DROP INDEX IF EXISTS idx_conversations_owner;
DROP INDEX IF EXISTS idx_model_blocks_household_shared;
DROP INDEX IF EXISTS idx_model_blocks_owner;

DROP TABLE IF EXISTS image_refs;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS mcp_server_registry;
DROP TABLE IF EXISTS model_blocks;
