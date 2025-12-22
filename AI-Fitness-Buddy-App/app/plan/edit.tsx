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
    View
} from 'react-native';
import { EXERCISE_DATABASE } from '../../data/exercises';
import { supabase } from '../../lib/supabase';

const MUSCLE_GROUPS = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Core'];

export default function EditPlanScreen() {
  const router = useRouter();
  const { dayIndex } = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  
  // Day State
  const [dayName, setDayName] = useState('');
  const [focus, setFocus] = useState('');
  const [exercises, setExercises] = useState<any[]>([]);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('All');

  useEffect(() => {
    fetchPlan();
  }, []);

  const fetchPlan = async () => {
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
        setPlan(data.data); 
        let days = [];
        if (data.data.weeks) days = data.data.weeks.flatMap((w: any) => w.days);
        else if (data.data.days) days = data.data.days;
        
        const idx = Number(dayIndex);
        if (days[idx]) {
           setDayName(days[idx].day_name);
           setFocus(days[idx].focus || '');
           setExercises(days[idx].exercises || []);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const updatedPlan = { ...plan };
      const idx = Number(dayIndex);
      
      const newDayData = {
        day_name: dayName,
        focus: focus,
        exercises: exercises
      };

      if (updatedPlan.weeks) {
         updatedPlan.weeks[0].days[idx] = newDayData;
      } else if (updatedPlan.days) {
         updatedPlan.days[idx] = newDayData;
      }

      await supabase
        .from('plans')
        .update({ data: updatedPlan })
        .eq('user_id', user!.id)
        .eq('active', true);

      Alert.alert("Success", "Plan updated!");
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const removeExercise = (index: number) => {
    const newEx = [...exercises];
    newEx.splice(index, 1);
    setExercises(newEx);
  };

  const addExercise = (ex: any) => {
    const newEx = {
        name: ex.name,
        sets: 3,
        reps: '10',
        rest: '60s'
    };
    setExercises([...exercises, newEx]);
    setModalVisible(false);
    setSearchQuery('');
    setSelectedMuscle('All');
  };

  // --- FILTER LOGIC ---
  const filteredExercises = EXERCISE_DATABASE.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMuscle = selectedMuscle === 'All' || ex.muscle === selectedMuscle;
    return matchesSearch && matchesMuscle;
  });

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF"/></View>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f4f6f9' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Stack.Screen options={{ title: "Edit Workout", headerBackTitle: "Back" }} />
        
        <View style={styles.container}>
            {/* FORM INPUTS */}
            <View style={styles.headerForm}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Day Name</Text>
                    <TextInput 
                        style={styles.input} 
                        value={dayName} 
                        onChangeText={setDayName} 
                        placeholder="e.g. Pull Day" 
                    />
                </View>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Focus Area</Text>
                    <TextInput 
                        style={styles.input} 
                        value={focus} 
                        onChangeText={setFocus} 
                        placeholder="e.g. Back & Biceps" 
                    />
                </View>
            </View>

            {/* LIST HEADER */}
            <View style={styles.listHeader}>
                <Text style={styles.sectionTitle}>Exercises ({exercises.length})</Text>
                <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addBtnSmall}>
                    <Text style={styles.addText}>+ Add</Text>
                </TouchableOpacity>
            </View>

            {/* DRAGGABLE LIST (Simulated with FlatList for now) */}
            <FlatList 
                data={exercises}
                keyExtractor={(_, i) => i.toString()}
                contentContainerStyle={{ paddingBottom: 100 }}
                renderItem={({ item, index }) => (
                    <View style={styles.exCard}>
                        <View style={styles.dragHandle}>
                             <Ionicons name="menu" size={20} color="#ccc" />
                        </View>
                        <View style={{flex: 1, marginLeft: 10}}>
                            <Text style={styles.exName}>{item.name}</Text>
                            <Text style={styles.exMeta}>{item.sets} sets x {item.reps}</Text>
                        </View>
                        <TouchableOpacity onPress={() => removeExercise(index)} style={styles.deleteBtn}>
                            <Ionicons name="trash-outline" size={20} color="#ff3b30" />
                        </TouchableOpacity>
                    </View>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>No exercises. Add one!</Text>}
            />

            {/* SAVE BUTTON (Fixed at bottom) */}
            <View style={styles.footer}>
                <TouchableOpacity style={styles.saveBtn} onPress={saveChanges} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff"/> : <Text style={styles.saveText}>Save Changes</Text>}
                </TouchableOpacity>
            </View>
        </View>

        {/* --- ADD EXERCISE MODAL --- */}
        <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaView style={styles.modalSafeArea}>
                <View style={styles.modalContainer}>
                    
                    {/* MODAL HEADER */}
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Add Exercise</Text>
                        <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>
                    
                    {/* SEARCH BAR */}
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

                    {/* MUSCLE FILTER CHIPS */}
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

                    {/* LIST */}
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

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, padding: 20 },
  
  headerForm: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  inputGroup: { flex: 1 },
  label: { fontSize: 11, color: '#666', marginBottom: 6, textTransform: 'uppercase', fontWeight: '700' },
  input: { backgroundColor: '#fff', padding: 12, borderRadius: 10, fontSize: 16, borderWidth: 1, borderColor: '#e1e1e1' },
  
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#333' },
  addBtnSmall: { backgroundColor: '#eef6ff', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  addText: { color: '#007AFF', fontWeight: '600', fontSize: 14 },

  exCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 3 },
  dragHandle: { justifyContent: 'center' },
  exName: { fontSize: 16, fontWeight: '600', color: '#333' },
  exMeta: { fontSize: 13, color: '#888', marginTop: 2 },
  deleteBtn: { padding: 8, backgroundColor: '#fff5f5', borderRadius: 8 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 40, fontStyle: 'italic' },

  footer: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  saveBtn: { backgroundColor: '#000', padding: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
  saveText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  // --- MODAL STYLES ---
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
  itemSubtitle: { fontSize: 13, color: '#888', marginTop: 2 }
});