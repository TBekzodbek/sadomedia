-- SQL for creating the users table in Supabase
CREATE TABLE IF NOT EXISTS users (
    chat_id BIGINT PRIMARY KEY,
    lang TEXT DEFAULT 'uz',
    state TEXT DEFAULT 'MAIN',
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- For requests and results, we can either use tables or keep them in-memory as they are ephemeral.
-- The current bot uses requests for storing temporary download info.
-- Let's stick to 'users' for now as that's the most critical data.
