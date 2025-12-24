import cors from 'cors';
import express from 'express';
import { Ollama } from 'ollama';
import { EXERCISE_DATABASE } from '../../data/exercises';

const app = express();
const port = 3000;

// Increase limit to allow sending large exercise lists
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// Configure Ollama
const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });

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
  const { goal, experience, equipment, days, split, availableExercises } = req.body;
  const dayCount = parseInt(days) || 3;
  
  // 1. Determine the split BEFORE logging so we see the real value
  const safeSplit = split || 'Full Body';

  // 2. Updated Log: Now explicitly shows the split being sent to Llama
  console.log(`Generating plan for: ${experience} ${goal} (${dayCount} days) - Split: ${safeSplit}`);

  const sourceExercises = (availableExercises && availableExercises.length > 0) 
    ? availableExercises 
    : EXERCISE_DATABASE;

  const optimizedExerciseList = sourceExercises.map((ex: any) => 
    `- ${ex.name} (${ex.muscle})`
  ).join('\n');

  let dayNames = SPLIT_TEMPLATES[safeSplit] || Array.from({ length: dayCount }, (_, i) => `Day ${i + 1}`);
  dayNames = dayNames.filter(d => d !== 'Rest').slice(0, dayCount);

  const prompt = `
    You are an elite strength coach. Create a 1-week workout plan.
    
    USER CONTEXT:
    - Goal: ${goal}
    - Level: ${experience}
    - Schedule: ${dayCount} days (${safeSplit} split)
    - Equipment: ${equipment}

    STRICT RULES:
    1. Structure: Generate exactly ${dayCount} days.
    2. Day Names: Use exactly: ${JSON.stringify(dayNames)}.
    3. Volume: 6-8 exercises per day.
    4. Database: You must ONLY select exercises from the list below. Do not invent names.
    
    ALLOWED EXERCISES:
    ${optimizedExerciseList}
    
    OUTPUT JSON ONLY (this exact format, there could be more exercises, adjust reps, sets and rest as needed):
    {
      "week_number": 1,
      "days": [
        { 
          "day_name": "${dayNames[0]}", 
          "focus": "Target Muscle", 
          "exercises": [
             { "name": "Exact Name From List", "sets": 3, "reps": "5", "rest": "120s" },
             { "name": "Exact Name From List", "sets": 3, "reps": "8", "rest": "90s" },
             { "name": "Exact Name From List", "sets": 3, "reps": "12", "rest": "90s" },
             { "name": "Exact Name From List", "sets": 3, "reps": "12", "rest": "90s" },
             { "name": "Exact Name From List", "sets": 3, "reps": "12", "rest": "90s" },
             { "name": "Exact Name From List", "sets": 3, "reps": "12", "rest": "90s" }
          ] 
        }
      ]
    }
  `;

  // ... (Rest of the code remains the same: Controller, fetch, response handling) ...
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000); 

  try {
    const response = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        messages: [{ role: 'user', content: prompt }],
        format: 'json',
        stream: false,
        options: {
           temperature: 0.2,
           num_ctx: 4096 
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
        throw new Error(`Ollama API Error: ${response.statusText}`);
    }

    const data = await response.json();
    let rawContent = (data as any).message.content;
    
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
        res.status(504).json({ error: "AI took too long to respond." });
    } else {
        res.status(500).json({ error: error.message || "Unknown error" });
    }
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`AI Server running on port ${port}`);
});