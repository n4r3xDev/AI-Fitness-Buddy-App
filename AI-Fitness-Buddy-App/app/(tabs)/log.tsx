import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { WorkoutDay } from '../../types';

// Types for the Logger State
interface SetLog {
  id: string; 
  weight: string;
  reps: string;
  rpe: string; // <--- NEW: Per-set RPE
  rest: string; 
}

interface ExerciseLog {
  name: string;
  sets: SetLog[];
}

export default function LogWorkoutScreen() {
  const router = useRouter();
  const { workoutIndex } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [dayName, setDayName] = useState("");
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchCurrentWorkout();
  }, []);

  const fetchCurrentWorkout = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
          .from('plans')
          .select('*')
          .eq('user_id', user.id)
          .eq('active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
      
      if (data && data.data) {
        const planData = data.data;
        const idx = Number(workoutIndex) || 0;
        let day: WorkoutDay | null = null;

        if (planData.weeks) day = planData.weeks[0]?.days?.[idx];
        else if (planData.days) day = planData.days[idx];

        if (day) {
          setDayName(day.day_name);
          
          const initialLogs: ExerciseLog[] = day.exercises.map(ex => {
            // FIX: Parsing logic. Split properly before removing non-digits.
            // "6-8" -> ["6", "8"] -> "6"
            // "12" -> ["12"] -> "12"
            const rawReps = ex.reps ? ex.reps.toString() : '10';
            const cleanReps = rawReps.split('-')[0].replace(/[^0-9]/g, '') || '10';

            return {
              name: ex.name,
              sets: Array.from({ length: ex.sets || 3 }).map(() => ({
                id: `${Math.random()}`, 
                weight: '',
                reps: cleanReps,
                rpe: '', // Default empty
                rest: ex.rest || '60s'
              }))
            };
          });
          setLogs(initialLogs);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const updateSet = (exIndex: number, setIndex: number, field: keyof SetLog, value: string) => {
    const newLogs = [...logs];
    newLogs[exIndex].sets[setIndex][field] = value;
    setLogs(newLogs);
  };

  const addSet = (exIndex: number) => {
    const newLogs = [...logs];
    const previousSet = newLogs[exIndex].sets[newLogs[exIndex].sets.length - 1];
    newLogs[exIndex].sets.push({
      id: `${Math.random()}`,
      weight: previousSet ? previousSet.weight : '',
      reps: previousSet ? previousSet.reps : '10',
      rpe: '',
      rest: previousSet ? previousSet.rest : '60s'
    });
    setLogs(newLogs);
  };

  const removeSet = (exIndex: number, setIndex: number) => {
    const newLogs = [...logs];
    if (newLogs[exIndex].sets.length > 1) {
      newLogs[exIndex].sets.splice(setIndex, 1);
      setLogs(newLogs);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Calculate an average RPE from the sets to satisfy the DB column requirement
      // or just default to 5 if they left it blank.
      let totalRpe = 0;
      let count = 0;
      logs.forEach(ex => ex.sets.forEach(s => {
        if (s.rpe) {
          totalRpe += parseInt(s.rpe);
          count++;
        }
      }));
      const avgRpe = count > 0 ? Math.round(totalRpe / count) : 0;

      await supabase.from('workout_logs').insert({
        user_id: user!.id,
        workout_day_index: Number(workoutIndex),
        rpe: avgRpe, // Storing average for high-level analytics
        notes: notes,
        exercise_data: logs, // Storing granular data (sets, reps, kg, rpe)
        fatigue_level: avgRpe > 8 ? 'high' : 'medium'
      });

      Alert.alert('Saved!', 'Great workout.');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF"/></View>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex: 1}}>
      <ScrollView style={styles.container} contentContainerStyle={{paddingBottom: 40}}>
        <Text style={styles.title}>{dayName}</Text>

        {logs.map((ex, exIndex) => (
          <View key={exIndex} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.exTitle}>{ex.name}</Text>
            </View>

            {/* Table Header - Now includes RPE */}
            <View style={styles.rowHeader}>
              <Text style={[styles.colHead, {width: 25}]}>#</Text>
              <Text style={[styles.colHead, {flex: 1}]}>KG</Text>
              <Text style={[styles.colHead, {flex: 1}]}>Reps</Text>
              <Text style={[styles.colHead, {flex: 1}]}>RPE</Text> 
              <Text style={[styles.colHead, {flex: 1}]}>Rest</Text>
              <View style={{width: 30}} />
            </View>

            {ex.sets.map((set, setIndex) => (
              <View key={set.id} style={styles.setRow}>
                <Text style={[styles.setNum, {width: 25}]}>{setIndex + 1}</Text>
                
                <TextInput 
                  style={styles.inputCell} 
                  placeholder="-" 
                  keyboardType="numeric"
                  value={set.weight}
                  onChangeText={(val) => updateSet(exIndex, setIndex, 'weight', val)}
                />
                
                <TextInput 
                  style={styles.inputCell} 
                  placeholder="0" 
                  keyboardType="numeric"
                  value={set.reps}
                  onChangeText={(val) => updateSet(exIndex, setIndex, 'reps', val)}
                />

                <TextInput 
                  style={styles.inputCell} 
                  placeholder="-" 
                  keyboardType="numeric"
                  maxLength={2}
                  value={set.rpe}
                  onChangeText={(val) => updateSet(exIndex, setIndex, 'rpe', val)}
                />

                <TextInput 
                  style={styles.inputCell} 
                  placeholder="60s" 
                  value={set.rest}
                  onChangeText={(val) => updateSet(exIndex, setIndex, 'rest', val)}
                />

                <TouchableOpacity onPress={() => removeSet(exIndex, setIndex)} style={styles.deleteBtn}>
                   <Ionicons name="trash-outline" size={18} color="#ff3b30" />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(exIndex)}>
               <Text style={styles.addSetText}>+ Set</Text>
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.footerCard}>
          <Text style={styles.sectionHeader}>Session Notes</Text>
          <TextInput 
              style={[styles.input, { height: 60 }]} 
              multiline 
              value={notes}
              onChangeText={setNotes}
              placeholder="Any pain or issues?"
          />
        </View>

        <TouchableOpacity style={styles.finishBtn} onPress={handleFinish} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.finishText}>Finish Workout</Text>}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7', padding: 15 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 20, marginTop: 40, color: '#000' },
  
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 15 },
  cardHeader: { marginBottom: 10 },
  exTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  
  rowHeader: { flexDirection: 'row', marginBottom: 8, paddingHorizontal: 2 },
  colHead: { fontSize: 11, color: '#888', fontWeight: '600', textAlign: 'center' },
  
  setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  setNum: { fontSize: 12, color: '#888', textAlign: 'center' },
  
  inputCell: { 
    flex: 1, backgroundColor: '#f9f9f9', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 4, 
    marginHorizontal: 2, fontSize: 14, textAlign: 'center', borderWidth: 1, borderColor: '#eee' 
  },
  
  deleteBtn: { width: 30, alignItems: 'center', justifyContent: 'center' },
  
  addSetBtn: { alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 16, backgroundColor: '#f0f8ff', borderRadius: 12, marginTop: 4 },
  addSetText: { color: '#007AFF', fontWeight: '600', fontSize: 12 },
  
  footerCard: { backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 20 },
  sectionHeader: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  input: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 8, fontSize: 16, borderWidth: 1, borderColor: '#eee' },
  
  finishBtn: { backgroundColor: '#000', padding: 18, borderRadius: 16, alignItems: 'center', marginBottom: 20 },
  finishText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});