const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ihsiuquldbepzdlwojpz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_KEY) {
    console.error('⚠️ WARNING: SUPABASE_KEY is missing. Database operations will fail.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY || 'placeholder');

// Persistent User Data
async function getUser(chatId, info = {}) {
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('chat_id', chatId)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
        console.error('Supabase getUser Error:', error);
    }

    if (!user) {
        const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert([{ chat_id: chatId, lang: 'uz', state: 'MAIN', ...info }])
            .select()
            .single();

        if (createError) console.error('Supabase createUser Error:', createError);
        return newUser || { lang: 'uz', state: 'MAIN' };
    }

    if (Object.keys(info).length > 0) {
        const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update({ ...info, updated_at: new Date() })
            .eq('chat_id', chatId)
            .select()
            .single();

        if (updateError) console.error('Supabase updateUser Error:', updateError);
        return updatedUser || user;
    }

    return user;
}

async function getAllUsers() {
    const { data, error } = await supabase.from('users').select('*');
    if (error) console.error('Supabase getAllUsers Error:', error);

    // Convert array to object to match old API if needed, 
    // or return as is and update index.js
    const userMap = {};
    (data || []).forEach(u => {
        userMap[u.chat_id] = u;
    });
    return userMap;
}

async function getLang(chatId) {
    const user = await getUser(chatId);
    return user.lang || 'uz';
}

async function setLang(chatId, lang) {
    const { error } = await supabase
        .from('users')
        .update({ lang, updated_at: new Date() })
        .eq('chat_id', chatId);
    if (error) console.error('Supabase setLang Error:', error);
}

async function getState(chatId) {
    const user = await getUser(chatId);
    return user.state || 'MAIN';
}

async function setState(chatId, state) {
    const { error } = await supabase
        .from('users')
        .update({ state, updated_at: new Date() })
        .eq('chat_id', chatId);
    if (error) console.error('Supabase setState Error:', error);
}

// In-memory data for transient states (Requests & Search Results)
// These don't need to be in Supabase as they expire quickly
let transientDb = {
    requests: {}, // { chatId: { url, title, type, timestamp } }
    results: {},  // { chatId: { total: [], page: 0 } }
};

function getRequest(chatId) {
    return transientDb.requests[chatId];
}

function setRequest(chatId, data) {
    if (data === null) {
        delete transientDb.requests[chatId];
    } else {
        transientDb.requests[chatId] = { ...data, timestamp: Date.now() };
    }
}

function getResults(chatId) {
    return transientDb.results[chatId];
}

function setResults(chatId, data) {
    if (data === null) {
        delete transientDb.results[chatId];
    } else {
        transientDb.results[chatId] = data;
    }
}

module.exports = {
    getLang,
    setLang,
    getState,
    setState,
    getRequest,
    setRequest,
    getResults,
    setResults,
    getAllUsers,
    getUser
};
