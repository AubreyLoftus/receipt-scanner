// --- CONFIGURATION ---
const SUPABASE_URL = 'https://xqjacybkimctqntemqed.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxamFjeWJraW1jdHFudGVtcWVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxODA5MjIsImV4cCI6MjA5NTc1NjkyMn0.lh_zhRtpyoVeMt1YK5HBLVM04FDpROGQXBWLIAqz8UM';

// --- CATEGORY COLORS ---
const CATEGORY_COLORS = {
  'Groceries':          '#2a9d8f',
  'Snacks & Drinks':    '#e9c46a',
  'Household':          '#264653',
  'Personal Care':      '#a8dadc',
  'Clothing':           '#e63946',
  'Electronics':        '#457b9d',
  'Kids & School':      '#f4a261',
  'Dining Out':         '#6d6875',
  'Coffee & Treats':    '#c77dff',
  'Gas & Auto':         '#e76f51',
  'Utilities & Bills':  '#219ebc',
  'Pet':                '#b5838d',
  'Entertainment':      '#52b788',
  'Gifts':              '#f72585',
  'Other':              '#aaaaaa'
};

function colorForCategory(cat) {
  return CATEGORY_COLORS[cat] || '#aaaaaa';
}

// --- MANUAL CATEGORY OVERRIDE ---
let manualCategory = null;

function setupCategoryButtons() {
  const buttons = document.querySelectorAll('.cat-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('active')) {
        btn.classList.remove('active');
        manualCategory = null;
        document.getElementById('categoryNote').textContent = 'Auto-detecting categories';
      } else {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        manualCategory = btn.dataset.category;
        document.getElementById('categoryNote').textContent =
          'Will log as: ' + manualCategory + ' (total only)';
      }
    });
  });
}

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
    `${SUPABASE_URL}/rest/v1/receipts?order=scanned_at.desc&limit=200`, {
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
    body: JSON.stringify({
      image: base64Image,
      mimeType: mimeType,
      manualCategory: manualCategory
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error);

  const text = data.content && data.content[0] && data.content[0].text;
  if (!text) throw new Error('No response text from Claude');

  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error('Could not parse receipt data. Try a clearer photo.');
  }
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

    status.textContent = 'Found ' + parsed.items.length + ' item(s) at ' + parsed.store;
    displayResults(parsed.items, parsed.store);
    await saveItems(parsed.items, parsed.store);
    await refreshHistory();
  } catch (err) {
    status.textContent = 'Error: ' + err.message;
    status.textContent = 'Error: ' + err.message;
console.log('Scan error detail:', err);
results.innerHTML = '<div style="background:#fff0f0;padding:12px;border-radius:8px;color:#c00;font-size:0.85rem;margin-top:8px;"><strong>Debug info:</strong><br>' + err.message + '</div>';
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
    const color = colorForCategory(item.category);
    return `<div class="item-card">
      <div>
        <div class="item-name">${item.name}</div>
        <div class="item-meta">
          <span class="category-dot" style="background:${color}"></span>
          ${item.category}
        </div>
      </div>
      <div class="item-price">$${Number(item.price).toFixed(2)}</div>
    </div>`;
  }).join('');
}

// --- CHART ---
let chart = null;

function updateChart(items) {
  const categories = {};
  items.forEach(item => {
    const cat = item.category || 'Other';
    categories[cat] = (categories[cat] || 0) + Number(item.price);
  });

  const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(e => e[0]);
  const values = sorted.map(e => parseFloat(e[1].toFixed(2)));
  const colors = labels.map(colorForCategory);

  if (chart) chart.destroy();

  const ctx = document.getElementById('spendingChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Spending ($)',
        data: values,
        backgroundColor: colors,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ' $' + ctx.parsed.y.toFixed(2)
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: val => '$' + val }
        },
        x: {
          ticks: { maxRotation: 35, font: { size: 11 } }
        }
      }
    }
  });
}

// --- HISTORY ---
async function refreshHistory() {
  const items = await loadHistory();
  const historyEl = document.getElementById('history');
  if (!items.length) {
    historyEl.innerHTML = '<p style="color:#888">No scans yet.</p>';
    return;
  }
  updateChart(items);
  historyEl.innerHTML = items.map(function(item) {
    const color = colorForCategory(item.category);
    return `<div class="item-card">
      <div>
        <div class="item-name">${item.item_name}</div>
        <div class="item-meta">
          <span class="category-dot" style="background:${color}"></span>
          ${item.store} · ${item.category} · ${new Date(item.scanned_at).toLocaleDateString()}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="item-price">$${Number(item.price).toFixed(2)}</div>
        <button class="delete-btn" onclick="handleDelete(${item.id})">✕</button>
      </div>
    </div>`;
  }).join('');
}

async function handleDelete(id) {
  if (confirm('Delete this item?')) {
    await deleteItem(id);
    await refreshHistory();
  }
}

// --- INIT ---
setupCategoryButtons();
refreshHistory();
