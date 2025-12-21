import cors from 'cors';
import express from 'express';
import { Ollama } from 'ollama';
import { EXERCISE_DATABASE } from './exercises';

const app = express();
const port = 3000;

const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });

app.use(cors());
app.use(express.json());

app.post('/generate-plan', async (req, res) => {
  const { goal, experience, equipment, days, duration, split } = req.body;

  console.log(`Generating plan: ${split} (${days} days) for ${goal}`);

  // 1. We make the prompt even stricter
  const prompt = `
    You are an API that outputs ONLY raw JSON.
    Create a 1-week workout plan for a "${split}" split.
    
    Rules:
    1. Output MUST be valid JSON. No markdown ticks (\`\`\`), no intro text.
    2. Use ONLY exercises from this list: ${JSON.stringify(EXERCISE_DATABASE)}
    3. Generate exactly ${days} workout days.
    4. Each day must have 6-8 exercises.

    User Stats:
    - Goal: ${goal}
    - Level: ${experience}
    - Equipment: ${equipment}

    Structure:
    {
      "week_number": 1,
      "days": [
        { 
          "day_name": "Day 1 - Focus Name", 
          "focus": "Target Muscle", 
          "exercises": [
            { "name": "Exact Exercise Name", "sets": 3, "reps": "8-12", "rest": "60s" }
          ] 
        }
      ]
    }
  `;

  try {
    const response = await ollama.chat({
      model: 'phi3.5',
      messages: [{ role: 'user', content: prompt }],
      format: 'json', // Forces Ollama to try to output JSON mode
      stream: false,
    });

    let rawContent = response.message.content;

    // --- CLEANING LOGIC ---
    // 1. Remove Markdown code blocks if present (```json ... ```)
    rawContent = rawContent.replace(/```json/g, '').replace(/```/g, '');

    // 2. Find the first '{' and the last '}' to strip any "Here is your plan" text
    const firstBrace = rawContent.indexOf('{');
    const lastBrace = rawContent.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
      rawContent = rawContent.substring(firstBrace, lastBrace + 1);
    }
    // ----------------------

    try {
        const jsonResponse = JSON.parse(rawContent);
        res.json(jsonResponse);
    } catch (parseError) {
        console.error("JSON PARSE FAILED. Raw Content:", rawContent);
        res.status(500).json({ error: "AI generated invalid JSON. Please try again." });
    }

  } catch (error: any) {
    console.error("AI Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`AI Server running on port ${port}`);
});