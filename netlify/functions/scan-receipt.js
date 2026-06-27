exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const { image, mimeType, manualCategory } = JSON.parse(event.body);
    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
    if (!CLAUDE_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'API key not found in environment' })
      };
    }

    // If user manually picked a category, just read the total — no item breakdown needed
    const prompt = manualCategory
      ? `Look at this receipt. Return ONLY a valid JSON object, no markdown, no backticks:
{
  "store": "store name or Unknown",
  "items": [
    {"name": "Total", "price": 0.00, "category": "${manualCategory}"}
  ]
}
Read the total amount from the receipt and use it as the price. Category is already set to "${manualCategory}".`

      : `Look at this receipt and extract every item purchased.
Return ONLY a valid JSON object, no markdown, no backticks, no explanation — just the raw JSON:
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
- Dining Out (restaurant meals, fast food, takeout)
- Coffee & Treats (coffee drinks, lattes, pastries, desserts)
- Gas & Auto (fuel, car wash, auto parts, oil)
- Utilities & Bills (phone bill, electric, internet, subscriptions)
- Pet (pet food, pet supplies, treats)
- Entertainment (books, games, movies, seasonal decor)
- Gifts (presents, gift cards, flowers for someone else)
- Other (anything that does not fit above)`;

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
              text: prompt
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
