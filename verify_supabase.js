const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ihsiuquldbepzdlwojpz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

console.log('Testing Supabase Connection...');
console.log('URL:', SUPABASE_URL);
console.log('KEY present:', !!SUPABASE_KEY);

if (!SUPABASE_KEY) {
    console.error('❌ Error: SUPABASE_KEY is missing from .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
    try {
        const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
        if (error) {
            console.error('❌ Supabase Query Error:', error.message);
            if (error.code === 'PGRST116') {
                console.log('ℹ️ Table "users" exists but might be empty.');
            } else if (error.code === '42P01') {
                console.error('❌ Table "users" does not exist. Please run the SQL schema.');
            }
        } else {
            console.log('✅ Connection Successful! User count retrieved.');
        }
    } catch (e) {
        console.error('❌ Script Error:', e.message);
    }
}

test();
