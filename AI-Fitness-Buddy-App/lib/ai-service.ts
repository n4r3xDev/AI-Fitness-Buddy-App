// lib/ai-service.ts

export const generateTrainingPlan = async (data: any) => {
  try {
    // We expect 'data' to now contain 'availableExercises'
    const response = await fetch('http://192.168.0.31:3000/generate-plan', { // Use your local IP
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: data.goal,
        experience: data.experience_level,
        equipment: data.equipment.join(', '), // Convert array to string
        days: data.days_per_week,
        duration: data.session_duration_minutes,
        split: data.split,
        availableExercises: data.availableExercises // <--- VITAL: Pass the list to backend
      }),
    });

    if (!response.ok) {
      throw new Error(`Server Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("AI Service Error:", error);
    throw error;
  }
};