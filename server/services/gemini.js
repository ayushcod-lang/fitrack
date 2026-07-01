const { GoogleGenerativeAI } = require('@google/generative-ai');

const parseFood = async (text) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const genAI = new GoogleGenerativeAI(apiKey);

  // Models to try in order (only models that exist as of 2025+)
  const modelNames = ['gemini-2.5-flash', 'gemini-2.0-flash'];

  const prompt = `You are a precise nutrition expert specializing in Indian and international cuisine. Analyze this meal description and estimate nutritional content.

Meal: "${text}"

Respond with valid JSON matching this exact schema:
{
  "calories": <total as integer>,
  "protein": <grams as integer>,
  "carbs": <grams as integer>,
  "fats": <grams as integer>,
  "items": [
    { "name": "<food name>", "calories": <integer>, "protein": <integer>, "carbs": <integer>, "fats": <integer> }
  ]
}

Reference values:
- 1 roti/chapati: 120 kcal, 3g protein, 18g carbs, 4g fat
- 1 cup dal: 180 kcal, 12g protein, 28g carbs, 3g fat
- 1 cup rice: 200 kcal, 4g protein, 45g carbs, 0.5g fat
- 1 egg: 78 kcal, 6g protein, 0.6g carbs, 5g fat
- 1 chicken breast (150g): 232 kcal, 43g protein, 0g carbs, 5g fat
- 1 banana: 90 kcal, 1g protein, 23g carbs, 0.3g fat
- 1 cup paneer (200g): 340 kcal, 24g protein, 6g carbs, 26g fat`;

  let lastError;

  for (const modelName of modelNames) {
    try {
      console.log(`Trying Gemini model: ${modelName}`);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingBudget: 0 },
        }
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const rawText = response.text();

      console.log(`Gemini ${modelName} raw response:`, rawText.substring(0, 200));

      const parsed = JSON.parse(rawText);

      return {
        calories: Math.round(parsed.calories || 0),
        protein: Math.round(parsed.protein || 0),
        carbs: Math.round(parsed.carbs || 0),
        fats: Math.round(parsed.fats || 0),
        items: (parsed.items || []).map(item => ({
          name: item.name || 'Unknown',
          calories: Math.round(item.calories || 0),
          protein: Math.round(item.protein || 0),
          carbs: Math.round(item.carbs || 0),
          fats: Math.round(item.fats || 0),
        })),
      };
    } catch (err) {
      lastError = err;
      const errMsg = err.message || String(err);
      console.error(`Gemini ${modelName} failed:`, errMsg);

      // If it's a quota error, no point trying other models
      if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
        throw new Error(`Rate limit exceeded. Please wait a minute and try again. (${errMsg})`);
      }
    }
  }

  throw lastError || new Error('All Gemini models failed');
};

module.exports = { parseFood };
