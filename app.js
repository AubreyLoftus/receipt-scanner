// --- CONFIGURATION ---
const SUPABASE_URL = 'https://xqjacybkimctqntemqed.supabase.co';
const SUPABASE_KEY = 'sb_publishable_oMyepXsQ1YIUSxl95c2nqg_JhgyvjMG';
const CLAUDE_API_KEY = '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';

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

// --- CLAUDE API ---
async function scanReceipt(base64Image, mimeType) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-allow-browser': 'true'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: base64Image
            }
          },
          {
            type: 'text',
            text: `Look at this receipt and extract every item purchased.
Return ONLY a JSON object in this exact format, no other text:
{
  "store": "store name or Unknown",
  "items": [
    {"name": "item name", "price": 0.00, "category": "category"},
    ...
  ]
}
Categories to use: Produce, Dairy, Meat, Bakery, Frozen, Beverages, Snacks, Household, Personal Care, Other.`
          }
        ]
      }]
    })
  });

  const data = await response.json();
  const text = data.content[0].text;
  return JSON.parse(text);
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
    status.textContent = '✅ Receipt ready — tap Scan Receipt below!';
    results.innerHTML = '';
  } else {
    status.textContent = '❌ No file detected';
  }
});

scanBtn.addEventListener('click', async () => {
  const file = fileInput.files[0];
  if (!file) return;

  scanBtn.disabled = true;
  status.textContent = '⏳ Reading receipt...';

  try {
    const base64 = await toBase64(file);
    const mimeType = file.type;
    const parsed = await scanReceipt(base64, mimeType);

    status.textContent = `✅ Found ${parsed.items.length} items at ${parsed.store}`;
    displayResults(parsed.items, parsed.store);
    await saveItems(parsed.items, parsed.store);
    await refreshHistory();
  } catch (err) {
    status.textContent = '❌ Error: ' + err.message;
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
  results.innerHTML = `<h2>${store}</h2>` + items.map(item => `
    <div class="item-card">
      <div>
        <div class="item-name">${item.name}</div>
        <div class="item-meta">${item.category}</div>
      </div>
      <div class="item-price">$${Number(item.price).toFixed(2)}</div>
    </div>
  `).join('');
}

async function refreshHistory() {
  const items = await loadHistory();
  const historyEl = document.getElementById('history');
  if (!items.length) {
    historyEl.innerHTML = '<p style="color:#888">No scans yet.</p>';
    return;
  }
  historyEl.innerHTML = items.map(item => `
    <div class="item-card">
      <div>
        <div class="item-name">${item.item_name}</div>
        <div class="item-meta">${item.store} · ${item.category} · ${new Date(item.scanned_at).toLocaleDateString()}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="item-price">$${Number(item.price).toFixed(2)}</div>
        <button class="delete-btn" onclick="handleDelete(${item.id})">🗑</button>
      </div>
    </div>
  `).join('');
}

async function handleDelete(id) {
  if (confirm('Delete this item?')) {
    await deleteItem(id);
    await refreshHistory();
  }
}

// Load history on startup
refreshHistory();