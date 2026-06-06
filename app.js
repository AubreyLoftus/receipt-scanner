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
  const response = await fetch('/.netlify/functions/scan-receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image, mimeType: mimeType })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  const text = data.content[0].text;
const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
return JSON.parse(cleaned);
}

// --- UI ---
const fileInput = document.getElementById('fileInput');
const preview = document.getElementById('preview');
const scanBtn = document.getElementById('scanBtn');
const status = document.getElementById('status');
const results = document.getElementById('results');

fileInput.addEventListener('change', function() {
  if (this.files && this.files[0]) {
    const file = this.files[0];
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.style.display = 'block';
    scanBtn.style.display = 'block';
    status.textContent = 'Receipt ready — tap Scan Receipt below!';
    results.innerHTML = '';
  } else {
    status.textContent = 'No file detected';
  }
});

scanBtn.addEventListener('click', async () => {
  const file = fileInput.files[0];
  if (!file) return;

  scanBtn.disabled = true;
  status.textContent = 'Reading receipt...';

  try {
    const base64 = await toBase64(file);
    const mimeType = file.type;
    const parsed = await scanReceipt(base64, mimeType);

    status.textContent = 'Found ' + parsed.items.length + ' items at ' + parsed.store;
    displayResults(parsed.items, parsed.store);
    await saveItems(parsed.items, parsed.store);
    await refreshHistory();
  } catch (err) {
    status.textContent = 'Error: ' + err.message;
  } finally {
    scanBtn.disabled = false;
  }
});

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function displayResults(items, store) {
  results.innerHTML = '<h2>' + store + '</h2>' + items.map(function(item) {
    return '<div class="item-card"><div><div class="item-name">' + item.name + '</div><div class="item-meta">' + item.category + '</div></div><div class="item-price">$' + Number(item.price).toFixed(2) + '</div></div>';
  }).join('');
}

async function refreshHistory() {
  const items = await loadHistory();
  const historyEl = document.getElementById('history');
  if (!items.length) {
    historyEl.innerHTML = '<p style="color:#888">No scans yet.</p>';
    return;
  }
  historyEl.innerHTML = items.map(function(item) {
    return '<div class="item-card"><div><div class="item-name">' + item.item_name + '</div><div class="item-meta">' + item.store + ' - ' + item.category + ' - ' + new Date(item.scanned_at).toLocaleDateString() + '</div></div><div style="display:flex;align-items:center;gap:8px;"><div class="item-price">$' + Number(item.price).toFixed(2) + '</div><button class="delete-btn" onclick="handleDelete(' + item.id + ')">Delete</button></div></div>';
  }).join('');
}

async function handleDelete(id) {
  if (confirm('Delete this item?')) {
    await deleteItem(id);
    await refreshHistory();
  }
}

refreshHistory();