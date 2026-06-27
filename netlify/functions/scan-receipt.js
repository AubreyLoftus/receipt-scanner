exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const { image, mimeType } = JSON.parse(event.body);
    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
    if (!CLAUDE_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'API key not found in environment' })
      };
    }
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: image }
            },
            {
              type: 'text',
              text: `Look at this receipt and extract every item purchased.
Return ONLY a valid JSON object, no markdown, no backticks, no explanation — just the raw JSON.
Use this exact format:
{
  "store": "store name or Unknown",
  "items": [
    {"name": "item name", "price": 0.00, "category": "category"}
  ]
}

You MUST assign each item one of these exact categories (pick the best fit, never invent a new one):
- Groceries (food ingredients, produce, dairy, meat, bread, canned goods)
- Snacks & Drinks (chips, soda, juice, candy, coffee, tea, snack bars)
- Household (cleaning supplies, paper towels, trash bags, laundry, candles)
- Personal Care (shampoo, soap, deodorant, toothpaste, makeup, medicine)
- Clothing (shirts, pants, shoes, socks, underwear, accessories)
- Electronics (batteries, cables, light bulbs, tech accessories, gadgets)
- Kids & School (toys, school supplies, baby items, crafts)
- Dining & Prepared Food (hot food, deli items, ready-to-eat meals)
- Pet (pet food, pet supplies, treats)
- Entertainment (books, games, movies, seasonal decor)
- Other (anything that does not fit above)`
            }
          ]
        }]
      })
    });
    const data = await response.json();
    if (data.error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: data.error.message })
      };
    }
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
