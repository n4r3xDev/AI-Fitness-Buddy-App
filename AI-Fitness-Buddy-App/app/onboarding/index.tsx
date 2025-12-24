import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { generateTrainingPlan } from '../../lib/ai-service';
import { getValidSplits } from '../../lib/splits';
import { supabase } from '../../lib/supabase';
// 1. IMPORT YOUR DATABASE
import { EXERCISE_DATABASE } from '../../data/exercises';

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    goal: 'build_muscle',
    experience_level: 'intermediate',
    equipment: [] as string[],
    days_per_week: 3,
    session_duration_minutes: 60,
    split: '' 
  });

  const toggleEquipment = (item: string) => {
    const current = new Set(formData.equipment);
    if (current.has(item)) current.delete(item);
    else current.add(item);
    setFormData({ ...formData, equipment: Array.from(current) });
  };

  const handleNext = () => {
    if (step === 4 && !formData.split) {
        return Alert.alert("Select a Split", "Please choose a workout style.");
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
    else router.back();
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      console.log("1. Getting User...");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // 1. Save Profile
      console.log("2. Saving Profile...");
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          ...formData,
          equipment: formData.equipment 
        });
      if (profileError) throw profileError;

      // 2. Generate Plan
      console.log("3. Calling AI Service...");
      
      // --- CRITICAL UPDATE: PASS THE DATABASE HERE ---
      const plan = await generateTrainingPlan({
          ...formData,
          availableExercises: EXERCISE_DATABASE // <--- Passing the "Menu" to the Chef
      });
      
      console.log("4. AI Response:", JSON.stringify(plan, null, 2));

      // 3. Save Plan
      console.log("5. Saving Plan to Supabase...");
      const { error: planError } = await supabase
        .from('plans')
        .insert({
          user_id: user.id,
          data: plan,
          active: true
        });
      if (planError) throw planError;

      console.log("6. Success! Navigating...");
      router.replace('/(tabs)');

    } catch (error: any) {
      console.error("FINAL ERROR:", error);
      Alert.alert('Error', error.message || "Failed to generate plan");
    } finally {
      setLoading(false);
    }
  };

  // ... (The rest of your render code stays exactly the same) ...
  const renderStep = () => {
    switch (step) {
      case 0: // Goal
        return (
          <View>
            <Text style={styles.title}>What is your main goal?</Text>
            {['lose_weight', 'build_muscle', 'strength', 'endurance'].map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.option, formData.goal === g && styles.activeOption]}
                onPress={() => setFormData({ ...formData, goal: g })}
              >
                <Text style={[styles.optionText, formData.goal === g && styles.activeOptionText]}>
                  {g.replace('_', ' ').toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 1: // Experience
        return (
          <View>
            <Text style={styles.title}>Your experience level?</Text>
            {['beginner', 'intermediate', 'advanced'].map((l) => (
              <TouchableOpacity
                key={l}
                style={[styles.option, formData.experience_level === l && styles.activeOption]}
                onPress={() => setFormData({ ...formData, experience_level: l })}
              >
                <Text style={[styles.optionText, formData.experience_level === l && styles.activeOptionText]}>
                  {l.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 2: // Equipment
        const equipmentList = ['Gym Full', 'Dumbbells', 'Barbell', 'Bodyweight', 'Resistance Bands'];
        return (
          <View>
            <Text style={styles.title}>Available Equipment</Text>
            <Text style={styles.subtitle}>Select all that apply</Text>
            {equipmentList.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.option, formData.equipment.includes(item) && styles.activeOption]}
                onPress={() => toggleEquipment(item)}
              >
                <Text style={[styles.optionText, formData.equipment.includes(item) && styles.activeOptionText]}>
                  {item}
                </Text>
                {formData.equipment.includes(item) && <Ionicons name="checkmark-circle" size={24} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>
        );

      case 3: // Schedule (Days & Time)
        return (
          <View>
            <Text style={styles.title}>Your Schedule</Text>
            
            <Text style={styles.label}>Days per week: {formData.days_per_week}</Text>
            <View style={styles.row}>
              {[2, 3, 4, 5, 6].map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[styles.chip, formData.days_per_week === num && styles.activeChip]}
                  onPress={() => setFormData({ ...formData, days_per_week: num, split: '' })} // Reset split on change
                >
                  <Text style={[styles.chipText, formData.days_per_week === num && styles.activeChipText]}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { marginTop: 30 }]}>Duration: {formData.session_duration_minutes} min</Text>
            <View style={styles.row}>
                {[30, 45, 60, 90].map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[styles.chip, formData.session_duration_minutes === num && styles.activeChip]}
                  onPress={() => setFormData({ ...formData, session_duration_minutes: num })}
                >
                  <Text style={[styles.chipText, formData.session_duration_minutes === num && styles.activeChipText]}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 4: // NEW: Split Selection
        const validSplits = getValidSplits(formData.days_per_week);
        return (
          <View>
            <Text style={styles.title}>Choose Your Style</Text>
            <Text style={styles.subtitle}>Best options for {formData.days_per_week} days/week</Text>

            {validSplits.map((split) => (
              <TouchableOpacity
                key={split.id}
                style={[styles.cardOption, formData.split === split.id && styles.activeCard]}
                onPress={() => setFormData({ ...formData, split: split.id })}
              >
                <View>
                    <Text style={[styles.cardTitle, formData.split === split.id && styles.activeText]}>{split.name}</Text>
                    <Text style={[styles.cardDesc, formData.split === split.id && styles.activeDesc]}>{split.description}</Text>
                </View>
                {formData.split === split.id && <Ionicons name="checkmark-circle" size={24} color="#007AFF" />}
              </TouchableOpacity>
            ))}
          </View>
        );

      case 5: // Review
        return (
          <View>
            <Text style={styles.title}>Ready to Generate?</Text>
            <View style={styles.summaryCard}>
                <Text style={styles.summaryItem}>Goal: {formData.goal.replace('_', ' ')}</Text>
                <Text style={styles.summaryItem}>Level: {formData.experience_level}</Text>
                <Text style={styles.summaryItem}>Schedule: {formData.days_per_week} days ({formData.split})</Text>
                <Text style={styles.summaryItem}>Duration: {formData.session_duration_minutes} min</Text>
            </View>
            <Text style={styles.infoText}>
                Our AI coach will now build a custom plan using strictly verified exercises.
            </Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${((step + 1) / 6) * 100}%` }]} />
        </View>
        <Text style={styles.stepCounter}>{step + 1}/6</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {renderStep()}
      </ScrollView>

      <View style={styles.footer}>
        {step === 5 ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleFinish} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Generate Plan</Text>}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleNext}>
            <Text style={styles.btnText}>Next</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  backBtn: { padding: 5, marginRight: 10 },
  progressContainer: { flex: 1, height: 6, backgroundColor: '#f0f0f0', borderRadius: 3, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#007AFF' },
  stepCounter: { marginLeft: 10, fontWeight: 'bold', color: '#666' },
  content: { padding: 20 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 10, color: '#1c1c1e' },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 20 },
  option: { 
    padding: 20, borderRadius: 12, backgroundColor: '#f9f9f9', marginBottom: 12, 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: '#eee'
  },
  activeOption: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  optionText: { fontSize: 16, fontWeight: '600', color: '#333' },
  activeOptionText: { color: '#fff' },
  label: { fontSize: 18, fontWeight: '600', marginBottom: 15 },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  chip: { 
    width: 60, height: 50, justifyContent: 'center', alignItems: 'center', 
    backgroundColor: '#f5f5f5', borderRadius: 10, borderWidth: 1, borderColor: '#eee' 
  },
  activeChip: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  chipText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  activeChipText: { color: '#fff' },
  cardOption: {
    padding: 20, borderRadius: 16, backgroundColor: '#fff', marginBottom: 15,
    borderWidth: 1, borderColor: '#e0e0e0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2
  },
  activeCard: { borderColor: '#007AFF', backgroundColor: '#f0f8ff' },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4, color: '#333' },
  activeText: { color: '#007AFF' },
  cardDesc: { fontSize: 14, color: '#666' },
  activeDesc: { color: '#444' },
  summaryCard: { backgroundColor: '#f9f9f9', padding: 20, borderRadius: 12, marginBottom: 20 },
  summaryItem: { fontSize: 16, marginBottom: 8, color: '#333', fontWeight: '500' },
  infoText: { fontSize: 14, color: '#666', lineHeight: 20 },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  primaryBtn: { backgroundColor: '#007AFF', padding: 18, borderRadius: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});