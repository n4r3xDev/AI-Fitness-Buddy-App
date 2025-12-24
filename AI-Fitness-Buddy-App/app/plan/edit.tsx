import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform, SafeAreaView, ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { EXERCISE_DATABASE } from '../../data/exercises';
import { supabase } from '../../lib/supabase';

const MUSCLE_GROUPS = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Core'];

const SET_TYPES: { id: string; name: string; color: string; textColor: string; label: string }[] = [
  { id: 'W', name: 'Warm Up', color: '#fff3cd', textColor: '#856404', label: 'W' },
  { id: 'N', name: 'Normal', color: '#f2f2f7', textColor: '#333', label: '#' },
  { id: 'D', name: 'Drop Set', color: '#e8daff', textColor: '#6f42c1', label: 'D' },
  { id: 'F', name: 'Failure', color: '#f8d7da', textColor: '#721c24', label: 'F' },
];

export default function EditPlanScreen() {
  const router = useRouter();
  const { dayIndex } = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [planData, setPlanData] = useState<any>(null);
  
  const [dayName, setDayName] = useState('');
  const [focus, setFocus] = useState('');
  const [exercises, setExercises] = useState<any[]>([]);

  // Modal States
  const [addExerciseModalVisible, setAddExerciseModalVisible] = useState(false);
  const [setTypeModalVisible, setSetTypeModalVisible] = useState(false);
  const [targetSet, setTargetSet] = useState<{exIndex: number, setIndex: number} | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('All');

  useEffect(() => {
    fetchPlanWithRetry(0);
  }, []);

  const fetchPlanWithRetry = async (attempts: number) => {
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

      if (data) {
        setPlanData(data.data);
        const idx = Number(dayIndex);
        let targetDay = null;

        if (data.data.weeks && Array.isArray(data.data.weeks) && data.data.weeks.length > 0) {
            const allDays = data.data.weeks.flatMap((w: any) => w.days || []);
            targetDay = allDays[idx];
        } else if (data.data.days && Array.isArray(data.data.days)) {
            targetDay = data.data.days[idx];
        }

        if (targetDay) {
           setDayName(targetDay.day_name || '');
           setFocus(targetDay.focus || '');
           setExercises(targetDay.exercises || []);
           setLoading(false);
        } else {
           if (attempts < 3) {
               setTimeout(() => fetchPlanWithRetry(attempts + 1), 1000); 
           } else {
               setLoading(false);
               Alert.alert("Sync Error", "Could not find this day. Please return to dashboard and refresh.");
           }
        }
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const saveChanges = async () => {
    if (!planData) return;
    setSaving(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const idx = Number(dayIndex);
      
      const updatedDay = {
        day_name: dayName,
        focus: focus,
        exercises: exercises
      };

      const updatedPlan = JSON.parse(JSON.stringify(planData));

      if (updatedPlan.weeks && Array.isArray(updatedPlan.weeks) && updatedPlan.weeks.length > 0) {
          let currentIdx = 0;
          let found = false;
          for (let i = 0; i < updatedPlan.weeks.length; i++) {
              const dCount = updatedPlan.weeks[i].days?.length || 0;
              if (idx >= currentIdx && idx < currentIdx + dCount) {
                  updatedPlan.weeks[i].days[idx - currentIdx] = updatedDay;
                  found = true;
                  break;
              }
              currentIdx += dCount;
          }
          if(!found && updatedPlan.weeks[0].days) {
              updatedPlan.weeks[0].days.push(updatedDay); 
          }
      } else {
          if (!updatedPlan.days) updatedPlan.days = [];
          updatedPlan.days[idx] = updatedDay;
      }

      const { error } = await supabase
        .from('plans')
        .update({ data: updatedPlan })
        .eq('user_id', user!.id)
        .eq('active', true);

      if (error) throw error;

      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (dayName !== '' || exercises.length > 0) {
        Alert.alert("Discard Changes?", "Are you sure?", [
            { text: "Keep Editing", style: "cancel" },
            { text: "Discard", style: "destructive", onPress: () => router.back() }
        ]);
    } else {
        router.back();
    }
  };

  // --- ACTIONS ---
  
  const openSetTypeModal = (exIndex: number, setIndex: number) => {
    setTargetSet({ exIndex, setIndex });
    setSetTypeModalVisible(true);
  };

  const changeSetType = (typeId: string) => {
    if (targetSet) {
        const { exIndex, setIndex } = targetSet;
        const newExercises = [...exercises];
        const ex = newExercises[exIndex];

        if (!ex.setTypes) ex.setTypes = [];
        for(let i=0; i<ex.sets; i++) if(!ex.setTypes[i]) ex.setTypes[i] = 'N';

        ex.setTypes[setIndex] = typeId;
        setExercises(newExercises);
    }
    setSetTypeModalVisible(false);
  };

  const getSetLabel = (setTypes: string[], currentIndex: number) => {
    const currentType = setTypes[currentIndex] || 'N';
    if (currentType === 'W') return 'W';
    
    let count = 0;
    for (let i = 0; i <= currentIndex; i++) {
       const t = setTypes[i] || 'N';
       if (t !== 'W') count++;
    }
    return count.toString();
  };

  // --- NEW: Universal Set Data Updater (Handles Arrays) ---
  const updateSetData = (exIndex: number, setIndex: number, field: 'weights' | 'reps' | 'rest', value: string) => {
    const newExercises = [...exercises];
    const ex = newExercises[exIndex];

    // Ensure arrays exist
    if (!ex.weights) ex.weights = [];
    if (!ex.reps) ex.reps = []; 
    // Wait: plan data might have 'reps' as a string "10" from old saves. 
    // If it's a string, we need to convert it to an array or handle hybrid.
    // Strategy: We will treat 'reps' property as the array source now.
    // If it was a string, we migrate it on the fly.
    
    if (typeof ex.reps === 'string') ex.reps = Array(ex.sets).fill(ex.reps);
    if (typeof ex.rest === 'string') ex.rest = Array(ex.sets).fill(ex.rest);
    
    // Fill gaps
    for(let i=0; i<ex.sets; i++) {
        if(!ex.weights[i]) ex.weights[i] = '';
        if(!ex.reps[i]) ex.reps[i] = '10';
        if(!ex.rest[i]) ex.rest[i] = '60s';
    }

    // Update specific set
    if (field === 'weights') ex.weights[setIndex] = value;
    if (field === 'reps') ex.reps[setIndex] = value;
    if (field === 'rest') ex.rest[setIndex] = value;

    setExercises(newExercises);
  };

  const incrementSet = (index: number) => {
    const updatedExercises = [...exercises];
    const currentSets = Number(updatedExercises[index].sets) || 0;
    updatedExercises[index].sets = currentSets + 1;
    
    // Ensure arrays grow
    const ex = updatedExercises[index];
    if (!ex.setTypes) ex.setTypes = [];
    ex.setTypes[currentSets] = 'N';
    
    // Migrate to array if needed
    if (typeof ex.reps === 'string') ex.reps = Array(currentSets).fill(ex.reps);
    if (typeof ex.rest === 'string') ex.rest = Array(currentSets).fill(ex.rest);
    if (!ex.weights) ex.weights = [];

    // Inherit values from previous set for convenience
    ex.reps[currentSets] = ex.reps[currentSets-1] || '10';
    ex.rest[currentSets] = ex.rest[currentSets-1] || '60s';
    ex.weights[currentSets] = ex.weights[currentSets-1] || '';

    setExercises(updatedExercises);
  };

  const decrementSet = (index: number) => {
    const updatedExercises = [...exercises];
    const currentSets = Number(updatedExercises[index].sets) || 1;
    if (currentSets > 1) {
        updatedExercises[index].sets = currentSets - 1;
        setExercises(updatedExercises);
    }
  };

  const removeExercise = (index: number) => {
    Alert.alert("Remove Exercise?", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        { 
            text: "Remove", style: "destructive", 
            onPress: () => {
                const newEx = [...exercises];
                newEx.splice(index, 1);
                setExercises(newEx);
            }
        }
    ]);
  };

  const addExercise = (ex: any) => {
    const newEx = { 
        name: ex.name, 
        sets: 3, 
        // We initialize as arrays now
        reps: ['10', '10', '10'], 
        rest: ['60s', '60s', '60s'], 
        weights: ['', '', ''],
        setTypes: ['N','N','N'] 
    };
    setExercises([...exercises, newEx]);
    setAddExerciseModalVisible(false);
    setSearchQuery('');
    setSelectedMuscle('All');
  };

  const filteredExercises = EXERCISE_DATABASE.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMuscle = selectedMuscle === 'All' || ex.muscle === selectedMuscle;
    return matchesSearch && matchesMuscle;
  });

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF"/></View>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f4f6f9' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Stack.Screen options={{ headerShown: false }} />
        
        <View style={styles.navBar}>
            <TouchableOpacity onPress={handleCancel} style={styles.navBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.navTitle}>Edit Template</Text>
            <TouchableOpacity onPress={saveChanges} disabled={saving} style={styles.navBtn}>
                {saving ? <ActivityIndicator color="#007AFF" /> : <Text style={styles.doneText}>Save</Text>}
            </TouchableOpacity>
        </View>

        <View style={styles.container}>
            <View style={styles.headerForm}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Day Name</Text>
                    <TextInput style={styles.input} value={dayName} onChangeText={setDayName} placeholder="e.g. Pull Day" />
                </View>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Focus Area</Text>
                    <TextInput style={styles.input} value={focus} onChangeText={setFocus} placeholder="e.g. Back" />
                </View>
            </View>

            <View style={styles.listHeader}>
                <Text style={styles.sectionTitle}>Exercises ({exercises.length})</Text>
                <TouchableOpacity onPress={() => setAddExerciseModalVisible(true)} style={styles.addBtnSmall}>
                    <Text style={styles.addText}>+ Add Exercise</Text>
                </TouchableOpacity>
            </View>

            <FlatList 
                data={exercises}
                keyExtractor={(_, i) => i.toString()}
                contentContainerStyle={{ paddingBottom: 100 }}
                renderItem={({ item, index }) => (
                    <View style={styles.exCard}>
                        <View style={styles.exHeaderRow}>
                            <Text style={styles.exName}>{item.name}</Text>
                            <TouchableOpacity onPress={() => removeExercise(index)} style={styles.deleteBtn}>
                                <Ionicons name="trash-outline" size={18} color="#ff3b30" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.tableHeader}>
                            <Text style={[styles.colHeader, {width: 40}]}>Type</Text>
                            <Text style={[styles.colHeader, {flex: 1}]}>KG</Text>
                            <Text style={[styles.colHeader, {flex: 1}]}>Reps</Text>
                            <Text style={[styles.colHeader, {flex: 1}]}>Rest</Text>
                            <View style={{width: 30}} />
                        </View>

                        {/* SETS */}
                        {Array.from({ length: Number(item.sets) || 1 }).map((_, setIdx) => {
                            // Safe Accessors
                            const setTypes = item.setTypes || [];
                            const typeId = setTypes[setIdx] || 'N';
                            const typeConfig = SET_TYPES.find(t => t.id === typeId) || SET_TYPES[1];
                            const displayLabel = getSetLabel(setTypes, setIdx);

                            // Handle Array vs String Legacy Data
                            const weightVal = Array.isArray(item.weights) ? (item.weights[setIdx] || '') : '';
                            const repsVal = Array.isArray(item.reps) ? (item.reps[setIdx] || '') : (item.reps || '10');
                            const restVal = Array.isArray(item.rest) ? (item.rest[setIdx] || '') : (item.rest || '60s');

                            return (
                                <View key={setIdx} style={styles.setRow}>
                                    
                                    <TouchableOpacity 
                                        style={[styles.typeBadge, { backgroundColor: typeConfig.color }]}
                                        onPress={() => openSetTypeModal(index, setIdx)}
                                    >
                                        <Text style={[styles.typeText, { color: typeConfig.textColor }]}>
                                            {displayLabel}
                                        </Text>
                                    </TouchableOpacity>
                                    
                                    {/* KG INPUT */}
                                    <TextInput 
                                        style={styles.cellInput}
                                        value={weightVal}
                                        onChangeText={(val) => updateSetData(index, setIdx, 'weights', val)}
                                        placeholder="-"
                                        keyboardType="numeric"
                                    />

                                    {/* REPS INPUT */}
                                    <TextInput 
                                        style={styles.cellInput}
                                        value={repsVal}
                                        onChangeText={(val) => updateSetData(index, setIdx, 'reps', val)}
                                        placeholder="10"
                                        keyboardType="numeric"
                                    />

                                    {/* REST INPUT */}
                                    <TextInput 
                                        style={styles.cellInput}
                                        value={restVal}
                                        onChangeText={(val) => updateSetData(index, setIdx, 'rest', val)}
                                        placeholder="60s"
                                    />

                                    <TouchableOpacity 
                                        style={styles.removeSetBtn}
                                        onPress={() => decrementSet(index)}
                                    >
                                        <Ionicons name="remove-circle-outline" size={20} color="#ccc" />
                                    </TouchableOpacity>
                                </View>
                            );
                        })}

                        <TouchableOpacity style={styles.addSetRow} onPress={() => incrementSet(index)}>
                            <Ionicons name="add" size={16} color="#007AFF" />
                            <Text style={styles.addSetRowText}>Add Set</Text>
                        </TouchableOpacity>

                    </View>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>No exercises added yet.</Text>}
            />
        </View>

        {/* --- MODAL 1: ADD EXERCISE --- */}
        <Modal visible={addExerciseModalVisible} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaView style={styles.modalSafeArea}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Add Exercise</Text>
                        <TouchableOpacity onPress={() => setAddExerciseModalVisible(false)} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color="#999" style={{marginRight: 8}} />
                        <TextInput 
                            style={styles.searchInput}
                            placeholder="Search exercises..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoFocus={false} 
                        />
                    </View>
                    <View style={styles.filterContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 5}}>
                            {MUSCLE_GROUPS.map((muscle) => (
                                <TouchableOpacity 
                                    key={muscle} 
                                    style={[styles.chip, selectedMuscle === muscle && styles.chipActive]}
                                    onPress={() => setSelectedMuscle(muscle)}
                                >
                                    <Text style={[styles.chipText, selectedMuscle === muscle && styles.chipTextActive]}>
                                        {muscle}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                    <FlatList 
                        data={filteredExercises}
                        keyExtractor={(item) => item.name}
                        contentContainerStyle={{ paddingBottom: 40 }}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.modalItem} onPress={() => addExercise(item)}>
                                <View>
                                    <Text style={styles.itemTitle}>{item.name}</Text>
                                    <Text style={styles.itemSubtitle}>{item.muscle} • {item.type}</Text>
                                </View>
                                <Ionicons name="add-circle" size={28} color="#007AFF" />
                            </TouchableOpacity>
                        )}
                    />
                </View>
            </SafeAreaView>
        </Modal>

        {/* --- MODAL 2: SET TYPE SELECTOR --- */}
        <Modal visible={setTypeModalVisible} transparent animationType="fade" onRequestClose={() => setSetTypeModalVisible(false)}>
            <TouchableWithoutFeedback onPress={() => setSetTypeModalVisible(false)}>
                <View style={styles.typeModalOverlay}>
                    <View style={styles.typeModalContent}>
                        <Text style={styles.typeModalTitle}>Select Set Type</Text>
                        {SET_TYPES.map((type) => (
                            <TouchableOpacity key={type.id} style={styles.typeOption} onPress={() => changeSetType(type.id)}>
                                <View style={[styles.typeBadgeSmall, { backgroundColor: type.color }]}>
                                    <Text style={[styles.typeBadgeText, { color: type.textColor }]}>{type.label}</Text>
                                </View>
                                <Text style={styles.typeOptionText}>{type.name}</Text>
                                {targetSet && (exercises[targetSet.exIndex]?.setTypes?.[targetSet.setIndex] === type.id || (!exercises[targetSet.exIndex]?.setTypes?.[targetSet.setIndex] && type.id === 'N')) && (
                                    <Ionicons name="checkmark" size={20} color="#007AFF" />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </TouchableWithoutFeedback>
        </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  navBtn: { padding: 5 },
  cancelText: { color: '#ff3b30', fontSize: 16 },
  doneText: { color: '#007AFF', fontSize: 16, fontWeight: 'bold' },
  navTitle: { fontSize: 17, fontWeight: '600' },
  container: { flex: 1, padding: 20 },
  headerForm: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  inputGroup: { flex: 1 },
  label: { fontSize: 11, color: '#666', marginBottom: 6, textTransform: 'uppercase', fontWeight: '700' },
  input: { backgroundColor: '#fff', padding: 12, borderRadius: 10, fontSize: 16, borderWidth: 1, borderColor: '#e1e1e1' },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#333' },
  addBtnSmall: { backgroundColor: '#eef6ff', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  addText: { color: '#007AFF', fontWeight: '600', fontSize: 14 },
  
  exCard: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 3 },
  exHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  exName: { fontSize: 16, fontWeight: '700', color: '#333', flex: 1 },
  deleteBtn: { padding: 6, backgroundColor: '#fff5f5', borderRadius: 6 },

  tableHeader: { flexDirection: 'row', marginBottom: 8, paddingHorizontal: 2 },
  colHeader: { fontSize: 11, color: '#999', fontWeight: '600', textAlign: 'center' },
  
  setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  typeBadge: { width: 40, height: 30, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginRight: 5 },
  typeText: { fontSize: 14, fontWeight: '700' },
  cellInput: { flex: 1, backgroundColor: '#f9f9f9', borderRadius: 8, paddingVertical: 8, textAlign: 'center', marginHorizontal: 4, fontSize: 14, fontWeight: '600', color: '#333' },
  removeSetBtn: { width: 30, alignItems: 'center' },
  addSetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, marginTop: 5, backgroundColor: '#f9f9f9', borderRadius: 8 },
  addSetRowText: { fontSize: 13, color: '#007AFF', fontWeight: '600', marginLeft: 6 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 40, fontStyle: 'italic' },

  modalSafeArea: { flex: 1, backgroundColor: '#fff' },
  modalContainer: { flex: 1, paddingHorizontal: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, marginBottom: 10 },
  modalTitle: { fontSize: 22, fontWeight: '800' },
  closeBtn: { padding: 5, backgroundColor: '#f0f0f0', borderRadius: 20 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f2f2f7', padding: 12, borderRadius: 12, marginBottom: 15 },
  searchInput: { flex: 1, fontSize: 16 },
  filterContainer: { marginBottom: 15, height: 40 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f2f2f7', marginRight: 8, justifyContent: 'center' },
  chipActive: { backgroundColor: '#000' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#666' },
  chipTextActive: { color: '#fff' },
  modalItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  itemTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  itemSubtitle: { fontSize: 13, color: '#888', marginTop: 2 },

  typeModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  typeModalContent: { width: '80%', backgroundColor: '#fff', borderRadius: 20, padding: 20, paddingVertical: 10 },
  typeModalTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 15, marginTop: 10 },
  typeOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  typeBadgeSmall: { width: 30, height: 24, borderRadius: 4, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  typeBadgeText: { fontSize: 12, fontWeight: 'bold' },
  typeOptionText: { fontSize: 16, color: '#333', flex: 1 },
});