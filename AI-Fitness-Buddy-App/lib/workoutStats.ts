// lib/workoutStats.ts

// 1. Calculate Total Volume
export const calculateVolume = (exercises: any[]) => {
  return exercises.reduce((total, exercise) => {
    const exerciseVolume = exercise.sets.reduce((setTotal: number, set: any) => {
      // Ensure we treat weight/reps as numbers to avoid "10" + "10" = "1010"
      const weight = parseFloat(set.weight) || 0;
      const reps = parseFloat(set.reps) || 0;
      
      // Only count if marked completed (if you have that check), otherwise count all
      return set.completed ? setTotal + (weight * reps) : setTotal;
    }, 0);
    return total + exerciseVolume;
  }, 0);
};

// 2. Count Personal Records (PRs)
export const countPRs = (currentExercises: any[], history: any[] = []) => {
  let prCount = 0;
  
  currentExercises.forEach(exercise => {
    // Logic: Find max weight lifted in this session
    const currentMax = Math.max(...exercise.sets.map((s: any) => parseFloat(s.weight) || 0));
    
    // Logic: Find max weight ever lifted for this exercise from history
    // (You can connect this to your real database later)
    const previousBest = history.find(h => h.name === exercise.name)?.maxWeight || 0;
    
    if (currentMax > previousBest && currentMax > 0) {
      prCount++;
    }
  });
  
  return prCount;
};