// --- CONFIGURATION ---
const SUPABASE_URL = 'https://xqjacybkimctqntemqed.supabase.co';
const SUPABASE_KEY = 'sb_publishable_oMyepXsQ1YIUSxl95c2nqg_JhgyvjMG';

// --- SUPABASE HELPERS ---
async function saveItems(items, store) {
  const rows = items.map(item => ({
    store: store,
    item_name: item.name,
    category: item.category,
    price: item.price
  }));

  const response = await fetch(`${SUPABASE_URL}/rest/v1/receipts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    },
    body: JSON.stringify(rows)
  });

  if (!response.ok) throw new Error('Failed to save to Supabase');
}

async function loadHistory() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/receipts?order=scanned_at.desc&limit=50`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  return await response.json();
}

async function deleteItem(id) {
  await fetch(`${SUPABASE_URL}/rest/v1/receipts?id=eq.${id}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
}

// --- CLAUDE API (via Netlify Function) ---
async function scanReceipt(base64Image, mimeType) {
  const response = await fetch('/.netlify/functions/scan-receipt'