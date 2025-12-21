// REPLACE THIS with your Windows machine's IP address (e.g., 192.168.1.15)
// Find it by running `ipconfig` in PowerShell
const LOCAL_AI_URL = 'http://192.168.1.14:3000'; 

export async function generateTrainingPlan(profile: any) {
  try {
    const response = await fetch(`${LOCAL_AI_URL}/generate-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: profile.goal,
        experience: profile.experience_level,
        equipment: profile.equipment.join(', '),
        days: profile.days_per_week,
        duration: profile.session_duration_minutes,
      }),
    });

    if (!response.ok) throw new Error('AI Server Error');
    
    return await response.json();
  } catch (error) {
    console.error("Local AI failed:", error);
    // FALLBACK: Return a dummy static plan so you aren't blocked during development
    return DUMMY_PLAN; 
  }
}

const DUMMY_PLAN = {
  week_number: 1,
  days: [
    {
      day_name: "Day 1 (Fallback)",
      focus: "Full Body",
      exercises: [{ name: "Pushups", sets: 3, reps: "10", rest: "60s" }]
    }
  ]
};