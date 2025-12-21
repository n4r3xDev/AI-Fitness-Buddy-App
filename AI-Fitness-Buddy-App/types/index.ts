export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
}

export interface WorkoutDay {
  day_name: string;
  focus: string;
  exercises: Exercise[];
  isCompleted?: boolean;
}

export interface TrainingWeek {
  week_number: number;
  days: WorkoutDay[];
}

export interface TrainingPlan {
  weeks: TrainingWeek[];
}

// User Profile matching the DB
export interface UserProfile {
  id: string;
  goal: 'lose_weight' | 'build_muscle' | 'endurance' | 'strength';
  experience_level: 'beginner' | 'intermediate' | 'advanced';
  equipment: string[];
  days_per_week: number;
  session_duration_minutes: number;
}