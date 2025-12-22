import cors from 'cors';
import express from 'express';
import { Ollama } from 'ollama';
import { EXERCISE_DATABASE } from './exercises';

const app = express();
const port = 3000;

const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });

app.use(cors());
app.use(express.json());

const SPLIT_TEMPLATES: Record<string, string[]> = {
  'Full Body': ['Full Body A', 'Full Body B', 'Full Body C'],
  'Upper Lower': ['Upper Body Power', 'Lower Body Power', 'Rest', 'Upper Body Hypertrophy', 'Lower Body Hypertrophy'],
  'Push Pull Legs': ['Push (Chest/Shoulders/Tri)', 'Pull (Back/Bi)', 'Legs', 'Rest', 'Upper Body', 'Lower Body'],
  'Torso Limbs': ['Torso (Chest/Back)', 'Limbs (Arms/Legs)', 'Rest', 'Torso', 'Limbs'],
  'Push Pull': ['Push', 'Pull', 'Rest', 'Push', 'Pull'],
  'Arnold Split': ['Chest & Back', 'Shoulders & Arms', 'Legs', 'Chest & Back', 'Shoulders & Arms', 'Legs'],
  'Body Part Split': ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms']
};

app.post('/generate-plan', async (req, res) => {
  const { goal, experience, equipment, days, duration, split } = req.body;
  const dayCount = parseInt(days) || 3;

  console.log(`Generating STRICT plan: ${split} (${dayCount} days) using Llama3.2`);

  const safeSplit = split || 'Full Body';
  let dayNames = SPLIT_TEMPLATES[safeSplit] || Array.from({ length: dayCount }, (_, i) => `Day ${i + 1}`);
  dayNames = dayNames.filter(d => d !== 'Rest').slice(0, dayCount);

  const prompt = `
    You are an elite strength coach.
    Create a 1-week workout plan.
    
    USER CONTEXT:
    - Goal: ${goal}
    - Level: ${experience}
    - Schedule: ${dayCount} days (${safeSplit} split)
    - Equipment: ${equipment}

    STRICT RULES:
    1. Structure: Generate exactly ${dayCount} days.
    2. Day Names: Use exactly: ${JSON.stringify(dayNames)}.
    3. Volume: EXACTLY 6 exercises per day.
    4. Database: Use ONLY these exercises: ${JSON.stringify(EXERCISE_DATABASE)}
    
    OUTPUT JSON ONLY:
    {
      "week_number": 1,
      "days": [
        { 
          "day_name": "${dayNames[0]}", 
          "focus": "Target Muscle", 
          "exercises": [
             { "name": "Compound Lift", "sets": 3, "reps": "6-8", "rest": "120s" },
             { "name": "Accessory Lift", "sets": 3, "reps": "8-12", "rest": "90s" },
             { "name": "Accessory Lift", "sets": 3, "reps": "8-12", "rest": "90s" },
             { "name": "Isolation Lift", "sets": 3, "reps": "12-15", "rest": "60s" },
             { "name": "Isolation Lift", "sets": 3, "reps": "12-15", "rest": "60s" },
             { "name": "Isolation Lift", "sets": 3, "reps": "15-20", "rest": "60s" }
          ] 
        }
      ]
    }
  `;

  // --- TIMEOUT CONFIGURATION ---
  const controller = new AbortController();
  // Set timeout to 300 seconds (5 minutes)
  const timeoutId = setTimeout(() => controller.abort(), 300000); 

  try {
    // We use raw fetch instead of the library to control the timeout
    const response = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2', // <--- Ensure you pulled this model!
        messages: [{ role: 'user', content: prompt }],
        format: 'json',
        stream: false,
        options: {
           temperature: 0.2, // Low creativity = better structure compliance
           num_ctx: 4096     // Ensure enough memory context
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId); // Clear timer if successful

    if (!response.ok) {
        throw new Error(`Ollama API Error: ${response.statusText}`);
    }

    const data = await response.json(); // Type checking skipped for brevity
    let rawContent = (data as any).message.content;
    
    // Clean Markdown
    rawContent = rawContent.replace(/```json/g, '').replace(/```/g, '');
    const firstBrace = rawContent.indexOf('{');
    const lastBrace = rawContent.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      rawContent = rawContent.substring(firstBrace, lastBrace + 1);
    }

    const jsonResponse = JSON.parse(rawContent);
    res.json(jsonResponse);

  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("AI Generation Failed:", error);
    if (error.name === 'AbortError') {
        res.status(504).json({ error: "AI took too long to respond (Timeout)." });
    } else {
        res.status(500).json({ error: error.message || "Unknown error" });
    }
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`AI Server running on port ${port}`);
});