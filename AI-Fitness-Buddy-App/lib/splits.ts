export type SplitOption = {
  id: string;
  name: string;
  description: string;
};

export function getValidSplits(days: number): SplitOption[] {
  if (days <= 2) {
    return [
      { id: 'Full Body', name: 'Full Body', description: 'Hit every muscle group each session.' }
    ];
  }
  
  if (days === 3) {
    return [
      { id: 'Full Body', name: 'Full Body (FBW)', description: 'Classic 3-day frequency. Best for beginners.' },
      { id: 'Push Pull Legs', name: 'Push / Pull / Legs', description: 'One dedicated day for each movement pattern.' },
      { id: 'Upper Lower Full', name: 'Upper / Lower / Full', description: 'Hybrid approach for balance.' }
    ];
  }

  if (days === 4) {
    return [
      { id: 'Upper Lower', name: 'Upper / Lower', description: '2 Upper days, 2 Lower days. Gold standard.' },
      { id: 'Torso Limbs', name: 'Torso / Limbs', description: 'Chest/Back/Shoulders vs Arms/Legs.' },
      { id: 'Push Pull', name: 'Push / Pull', description: 'Squat pattern with Push, Hinge pattern with Pull.' }
    ];
  }

  // 5+ Days
  return [
    { id: 'Push Pull Legs', name: 'PPL (Rotating)', description: 'High frequency, rotating schedule.' },
    { id: 'Body Part Split', name: 'Bro Split', description: 'Focus on 1-2 muscle groups per day.' },
    { id: 'Arnold Split', name: 'Arnold Split', description: 'Chest/Back, Shoulders/Arms, Legs.' }
  ];
}