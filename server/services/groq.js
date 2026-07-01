const Groq = require('groq-sdk');

const parseFoodWithGroq = async (text) => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('Groq API Key not configured');
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  
  const prompt = `Analyze this meal and estimate nutrition. Respond ONLY with valid JSON following this structure: 
  {"calories": 0, "protein": 0, "carbs": 0, "fats": 0, "items": [{"name": "item", "calories": 0, "protein": 0, "carbs": 0, "fats": 0}]}
  
  Meal: "${text}"`;

  const completion = await groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" }
  });

  const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
  return parsed;
};

module.exports = { parseFoodWithGroq };
