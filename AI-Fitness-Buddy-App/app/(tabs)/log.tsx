import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Vibration,
  View
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { WorkoutDay } from '../../types';

type SetType = 'N' | 'W' | 'D' | 'F';

interface SetLog {
  id: string; 
  type: SetType; 
  weight: string;
  reps: string;
  rpe: string; 
  rest: string; 
  completed: boolean; 
}

interface ExerciseLog {
  name: string;
  sets: SetLog[];
}

const SET_TYPES: { id: SetType; name: string; color: string; textColor: string; label: string }[] = [
  { id: 'W', name: 'Warm Up', color: '#fff3cd', textColor: '#856404', label: 'W' },
  { id: 'N', name: 'Normal', color: '#f2f2f7', textColor: '#333', label: '#' },
  { id: 'D', name: 'Drop Set', color: '#e8daff', textColor: '#6f42c1', label: 'D' },
  { id: 'F', name: 'Failure', color: '#f8d7da', textColor: '#721c24', label: 'F' },
];

export default function LogWorkoutScreen() {
  const router = useRouter();
  const { workoutIndex, sessionID } = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dayName, setDayName] = useState("");
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [notes, setNotes] = useState('');

  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [selectedSetLocation, setSelectedSetLocation] = useState<{exIndex: number, setIndex: number} | null>(null);

  const [restTimerActive, setRestTimerActive] = useState(false);
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const restTimerRef = useRef<any>(null); 

  const [workoutSeconds, setWorkoutSeconds] = useState(0);
  const workoutStartTimeRef = useRef<number | null>(null);
  const workoutIntervalRef = useRef<any>(null);

  useFocusEffect(
    useCallback(() => {
      resetState();
      workoutStartTimeRef.current = Date.now();
      workoutIntervalRef.current = setInterval(() => {
        if (workoutStartTimeRef.current) {
          const now = Date.now();
          const diff = Math.floor((now - workoutStartTimeRef.current) / 1000);
          setWorkoutSeconds(diff);
        }
      }, 1000);

      if (workoutIndex !== undefined) fetchCurrentWorkout();

      return () => {
        clearInterval(workoutIntervalRef.current);
        if (restTimerRef.current) clearTimeout(restTimerRef.current);
      };
    }, [workoutIndex, sessionID])
  );

  const resetState = () => {
    setWorkoutSeconds(0);
    setRestTimeLeft(0);
    setRestTimerActive(false);
    setNotes("");
    if (restTimerRef.current) clearTimeout(restTimerRef.current);
    if (workoutIntervalRef.current) clearInterval(workoutIntervalRef.current);
  };

  useEffect(() => {
    if (restTimerActive && restTimeLeft > 0) {
      restTimerRef.current = setTimeout(() => setRestTimeLeft((t) => t - 1), 1000);
    } else if (restTimeLeft === 0 && restTimerActive) {
      setRestTimerActive(false);
      Vibration.vibrate([0, 500, 200, 500]); 
    }
    return () => { if (restTimerRef.current) clearTimeout(restTimerRef.current); };
  }, [restTimeLeft, restTimerActive]);

  const startRestTimer = (seconds: number) => {
    if (restTimerRef.current) clearTimeout(restTimerRef.current);
    setTimeLeft(seconds);
    setRestTimerActive(true);
  };

  const stopRestTimer = () => {
    setRestTimerActive(false);
    if (restTimerRef.current) clearTimeout(restTimerRef.current);
  };

  // Helper function for setTimeLeft alias
  const setTimeLeft = (sec: number) => setRestTimeLeft(sec);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const fetchCurrentWorkout = async () => {
    setLoading(true);
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

        if (planData.weeks && Array.isArray(planData.weeks)) {
           const allDays = planData.weeks.flatMap((w: any) => w.days || []);
           day = allDays[idx];
        } else if (planData.days && Array.isArray(planData.days)) {
           day = planData.days[idx];
        }

        if (day) {
          setDayName(day.day_name || `Workout ${idx + 1}`);
          const initialLogs: ExerciseLog[] = (day.exercises || []).map((ex: any) => {
            const rawReps = ex.reps ? ex.reps.toString() : '10';
            const cleanReps = rawReps.split('-')[0].replace(/[^0-9]/g, '') || '10';
            const defaultRest = ex.rest ? ex.rest.replace('s', '') : '60';

            return {
              name: ex.name,
              sets: Array.from({ length: ex.sets || 3 }).map((_, i) => ({
                id: `${Math.random()}`, 
                type: 'N',
                weight: '',
                reps: cleanReps,
                rpe: '', 
                rest: defaultRest,
                completed: false
              }))
            };
          });
          setLogs(initialLogs);
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not load workout.");
    } finally {
      setLoading(false);
    }
  };

  const openSetTypeModal = (exIndex: number, setIndex: number) => {
    setSelectedSetLocation({ exIndex, setIndex });
    setTypeModalVisible(true);
  };

  const changeSetType = (type: SetType) => {
    if (selectedSetLocation) {
      const { exIndex, setIndex } = selectedSetLocation;
      const newLogs = [...logs];
      newLogs[exIndex].sets[setIndex].type = type;
      setLogs(newLogs);
    }
    setTypeModalVisible(false);
  };

  const getSetLabel = (sets: SetLog[], currentIndex: number) => {
     const currentSet = sets[currentIndex];
     if (currentSet.type === 'W') return 'W';
     let count = 0;
     for (let i = 0; i <= currentIndex; i++) {
        if (sets[i].type !== 'W') count++;
     }
     return count.toString();
  };

  const updateSet = (exIndex: number, setIndex: number, field: keyof SetLog, value: string) => {
    const newLogs = [...logs];
    // @ts-ignore
    newLogs[exIndex].sets[setIndex][field] = value;
    setLogs(newLogs);
  };

  const updateExerciseRest = (exIndex: number, newRest: string) => {
    const newLogs = [...logs];
    newLogs[exIndex].sets.forEach(set => {
        if (!set.completed) set.rest = newRest;
    });
    setLogs(newLogs);
  };

  const promptForExerciseRest = (exIndex: number) => {
    if (Platform.OS === 'android') {
        Alert.alert("Feature Note", "Alert.prompt is iOS only. We'll add a custom modal for Android later!");
        return;
    }
    Alert.prompt(
        "Set Rest Timer",
        "Enter rest time in seconds:",
        [
            { text: "Cancel", style: 'cancel' },
            { 
                text: "Set", 
                onPress: (val: string | undefined) => {
                    if (val && !isNaN(Number(val))) updateExerciseRest(exIndex, val);
                }
            }
        ],
        'plain-text',
        logs[exIndex].sets[0].rest
    );
  };

  const toggleComplete = (exIndex: number, setIndex: number) => {
    const newLogs = [...logs];
    const set = newLogs[exIndex].sets[setIndex];
    set.completed = !set.completed;
    setLogs(newLogs);

    if (set.completed) {
      const restTime = parseInt(set.rest) || 60;
      startRestTimer(restTime);
    }
  };

  const addSet = (exIndex: number) => {
    const newLogs = [...logs];
    const prev = newLogs[exIndex].sets[newLogs[exIndex].sets.length - 1];
    newLogs[exIndex].sets.push({
      id: `${Math.random()}`,
      type: 'N',
      weight: prev ? prev.weight : '',
      reps: prev ? prev.reps : '10',
      rpe: '',
      rest: prev ? prev.rest : '60',
      completed: false
    });
    setLogs(newLogs);
  };

  const handleFinish = async () => {
    if (workoutIntervalRef.current) clearInterval(workoutIntervalRef.current);
    if (restTimerRef.current) clearTimeout(restTimerRef.current);
    
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let totalRpe = 0;
      let count = 0;
      logs.forEach(ex => ex.sets.forEach(s => {
        if (s.rpe) { totalRpe += parseInt(s.rpe); count++; }
      }));
      const avgRpe = count > 0 ? Math.round(totalRpe / count) : 0;
      
      const durationStr = `Duration: ${formatDuration(workoutSeconds)}`;
      const finalNotes = notes ? `${notes}\n\n${durationStr}` : durationStr;

      // --- 3-TIER FATIGUE LOGIC ---
      let fatigue = 'medium';
      if (avgRpe >= 8) fatigue = 'high';
      else if (avgRpe <= 5) fatigue = 'low';

      await supabase.from('workout_logs').insert({
        user_id: user!.id,
        workout_day_index: Number(workoutIndex),
        rpe: avgRpe, 
        notes: finalNotes,
        exercise_data: logs,
        fatigue_level: fatigue // Saving calculated fatigue
      });

      Alert.alert('Workout Finished', `Great job! Time: ${formatDuration(workoutSeconds)}`);
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    Alert.alert("Discard Workout?", "Progress will be lost.", [
      { text: "Cancel", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => router.back() }
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF"/></View>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex: 1}}>
      <Stack.Screen 
        options={{
          title: "Log Workout",
          headerRight: () => (
            <TouchableOpacity onPress={handleDiscard} style={{ marginRight: 15, padding: 5 }}>
              <Text style={styles.discardText}>Cancel</Text>
            </TouchableOpacity>
          ),
        }} 
      />

      <ScrollView style={styles.container} contentContainerStyle={{paddingBottom: 150}}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{dayName}</Text>
          <View style={styles.workoutTimerBadge}>
            <Ionicons name="time-outline" size={16} color="#007AFF" />
            <Text style={styles.workoutTimerText}>{formatDuration(workoutSeconds)}</Text>
          </View>
        </View>

        {logs.map((ex, exIndex) => (
          <View key={exIndex} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{flex: 1}}>
                  <Text style={styles.exTitle}>{ex.name}</Text>
              </View>
              <TouchableOpacity style={styles.restHeaderBtn} onPress={() => promptForExerciseRest(exIndex)}>
                  <Ionicons name="timer-outline" size={16} color="#007AFF" />
                  <Text style={styles.restHeaderText}>{ex.sets[0]?.rest || 60}s</Text>
                  <Ionicons name="pencil" size={12} color="#007AFF" style={{marginLeft: 4}}/>
              </TouchableOpacity>
            </View>

            <View style={styles.rowHeader}>
              <Text style={[styles.colHead, {width: 40}]}>Set</Text>
              <Text style={[styles.colHead, {flex: 1}]}>kg</Text>
              <Text style={[styles.colHead, {flex: 1}]}>Reps</Text>
              <Text style={[styles.colHead, {flex: 1}]}>RPE</Text> 
              <View style={{width: 40}} />
            </View>

            {ex.sets.map((set, setIndex) => {
              const typeConfig = SET_TYPES.find(t => t.id === set.type) || SET_TYPES[1];
              const displayLabel = getSetLabel(ex.sets, setIndex);

              return (
                <View key={set.id} style={[styles.setRow, set.completed && styles.completedRow]}>
                  <TouchableOpacity 
                    style={[styles.typeBadge, { backgroundColor: typeConfig.color }]}
                    onPress={() => openSetTypeModal(exIndex, setIndex)}
                  >
                    <Text style={[styles.typeText, { color: typeConfig.textColor }]}>
                        {displayLabel}
                    </Text>
                  </TouchableOpacity>

                  <TextInput 
                    style={[styles.inputCell, set.completed && styles.completedInput]} 
                    placeholder="-" 
                    keyboardType="numeric"
                    value={set.weight}
                    onChangeText={(val) => updateSet(exIndex, setIndex, 'weight', val)}
                  />
                  
                  <TextInput 
                    style={[styles.inputCell, set.completed && styles.completedInput]} 
                    placeholder="0" 
                    keyboardType="numeric"
                    value={set.reps}
                    onChangeText={(val) => updateSet(exIndex, setIndex, 'reps', val)}
                  />

                  <TextInput 
                    style={[styles.inputCell, set.completed && styles.completedInput]} 
                    placeholder="-" 
                    keyboardType="numeric"
                    maxLength={2}
                    value={set.rpe}
                    onChangeText={(val) => updateSet(exIndex, setIndex, 'rpe', val)}
                  />

                  <TouchableOpacity 
                    style={[styles.checkBtn, set.completed && styles.checkedBtn]} 
                    onPress={() => toggleComplete(exIndex, setIndex)}
                  >
                     <Ionicons name="checkmark" size={18} color={set.completed ? "#fff" : "#ddd"} />
                  </TouchableOpacity>
                </View>
              );
            })}

            <View style={styles.cardFooter}>
                <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(exIndex)}>
                    <Text style={styles.addSetText}>+ Add Set</Text>
                </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={styles.footerCard}>
          <Text style={styles.sectionHeader}>Session Notes</Text>
          <TextInput 
              style={[styles.input, { height: 60 }]} 
              multiline 
              value={notes}
              onChangeText={setNotes}
              placeholder="How did it feel?"
          />
        </View>

        <TouchableOpacity style={styles.finishBtn} onPress={handleFinish} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.finishText}>Finish Workout</Text>}
        </TouchableOpacity>
      </ScrollView>

      {restTimerActive && (
        <View style={styles.timerBar}>
            <View style={styles.timerInfo}>
                <Text style={styles.timerLabel}>Resting</Text>
                <Text style={styles.timerValue}>{formatTime(restTimeLeft)}</Text>
            </View>
            <View style={styles.timerControls}>
                <TouchableOpacity style={styles.timerBtnSmall} onPress={() => setRestTimeLeft(t => t - 10)}>
                    <Text style={styles.timerBtnText}>-10</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.timerBtnSmall} onPress={() => setRestTimeLeft(t => t + 10)}>
                    <Text style={styles.timerBtnText}>+10</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.timerBtnSkip} onPress={stopRestTimer}>
                    <Text style={styles.timerBtnSkipText}>Skip</Text>
                </TouchableOpacity>
            </View>
        </View>
      )}

      <Modal
        visible={typeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTypeModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setTypeModalVisible(false)}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Select Set Type</Text>
                    {SET_TYPES.map((type) => (
                        <TouchableOpacity 
                            key={type.id} 
                            style={styles.modalOption}
                            onPress={() => changeSetType(type.id)}
                        >
                            <View style={[styles.modalBadge, { backgroundColor: type.color }]}>
                                <Text style={[styles.modalBadgeText, { color: type.textColor }]}>{type.label}</Text>
                            </View>
                            <Text style={styles.modalOptionText}>{type.name}</Text>
                            {selectedSetLocation && 
                             logs[selectedSetLocation.exIndex]?.sets[selectedSetLocation.setIndex].type === type.id && (
                                <Ionicons name="checkmark" size={20} color="#007AFF" />
                             )}
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        </TouchableWithoutFeedback>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7', padding: 15 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 10 },
  title: { fontSize: 24, fontWeight: '800', color: '#000', flex: 1 },
  workoutTimerBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eef6ff', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20 },
  workoutTimerText: { fontSize: 16, fontWeight: '700', color: '#007AFF', marginLeft: 6, fontVariant: ['tabular-nums'] },
  discardText: { color: '#ff3b30', fontSize: 16, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  exTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  restHeaderBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eef6ff', padding: 6, paddingHorizontal: 10, borderRadius: 12 },
  restHeaderText: { fontSize: 14, fontWeight: '600', color: '#007AFF', marginLeft: 4 },
  rowHeader: { flexDirection: 'row', marginBottom: 10, paddingHorizontal: 2 },
  colHead: { fontSize: 12, color: '#888', fontWeight: '600', textAlign: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  completedRow: { opacity: 0.6 },
  typeBadge: { width: 40, height: 30, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginRight: 5 },
  typeText: { fontSize: 14, fontWeight: '700' },
  inputCell: { flex: 1, height: 36, backgroundColor: '#f9f9f9', borderRadius: 8, marginHorizontal: 3, fontSize: 16, textAlign: 'center', fontWeight: '600', color: '#333' },
  completedInput: { backgroundColor: '#eee', color: '#888' },
  checkBtn: { width: 40, height: 36, borderRadius: 8, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', marginLeft: 5 },
  checkedBtn: { backgroundColor: '#34c759' },
  cardFooter: { flexDirection: 'row', justifyContent: 'center', marginTop: 5 },
  addSetBtn: { paddingVertical: 8, paddingHorizontal: 20, backgroundColor: '#f0f8ff', borderRadius: 20 },
  addSetText: { color: '#007AFF', fontWeight: '600', fontSize: 14 },
  footerCard: { backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 20 },
  sectionHeader: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  input: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 8, fontSize: 16 },
  finishBtn: { backgroundColor: '#000', padding: 18, borderRadius: 16, alignItems: 'center', marginBottom: 40 },
  finishText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  timerBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1c1c1e', padding: 15, paddingBottom: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 },
  timerInfo: { flexDirection: 'column' },
  timerLabel: { color: '#888', fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  timerValue: { color: '#fff', fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  timerControls: { flexDirection: 'row', gap: 10 },
  timerBtnSmall: { backgroundColor: '#333', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  timerBtnText: { color: '#fff', fontWeight: '600' },
  timerBtnSkip: { backgroundColor: '#ff3b30', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  timerBtnSkipText: { color: '#fff', fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: '#fff', borderRadius: 20, padding: 20, paddingVertical: 10 },
  modalTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 15, marginTop: 10 },
  modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalBadge: { width: 30, height: 24, borderRadius: 4, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  modalBadgeText: { fontSize: 12, fontWeight: 'bold' },
  modalOptionText: { fontSize: 16, color: '#333', flex: 1 },
});