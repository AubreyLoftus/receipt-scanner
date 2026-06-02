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

/