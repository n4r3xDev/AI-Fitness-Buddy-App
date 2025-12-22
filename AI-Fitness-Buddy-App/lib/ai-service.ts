import { TrainingPlan } from '../types';

// 1. Update the Interface to include 'split'
interface UserProfile {
  goal: string;
  experience_level: string;
  equipment: string[];
  days_per_week: number;
  session_duration_minutes: number;
  split: string; // <--- This was missing in the interface
}

// 2. CONFIG: Set your Server URL here
// For Physical Phone (Expo Go): Use your PC's IP, e.g., 'http://192.168.1.X:3000'
// For iOS Simulator: 'http://localhost:3000'
// For Android Emulator: 'http://10.0.2.2:3000'
const API_URL = 'http://192.168.1.14:3000'; // <--- REPLACE THIS with your actual local IP

export const generateTrainingPlan = async (profile: UserProfile): Promise<TrainingPlan> => {
  try {
    // 3. Construct the payload
    const payload = {
      goal: profile.goal,
      experience: profile.experience_level,
      equipment: profile.equipment.join(', '), 
      days: profile.days_per_week,
      duration: profile.session_duration_minutes,
      split: profile.split // <--- CRITICAL FIX: Sending the split choice
    };

    console.log(`[AI-Service] Sending request to ${API_URL}...`);
    console.log("[AI-Service] Payload:", JSON.stringify(payload));

    const response = await fetch(`${API_URL}/generate-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI Server Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('[AI-Service] Error:', error);
    // Throw a user-friendly error
    throw new Error(`Connection Failed: ${error.message}. Check if server is running at ${API_URL}`);
  }
};