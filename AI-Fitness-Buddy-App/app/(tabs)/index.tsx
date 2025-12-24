import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { TrainingPlan, WorkoutDay } from '../../types';

export default function DashboardScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  
  const [loading, setLoading] = useState(true);
  const [addingDay, setAddingDay] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [days, setDays] = useState<WorkoutDay[]>([]);
  const [lastLogs, setLastLogs] = useState<Record<number, string>>({}); 

  useFocusEffect(
    useCallback(() => {
      fetchActivePlan();
    }, [])
  );

  const fetchActivePlan = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: planWrapper, error } = await supabase
        .from('plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (planWrapper) {
        let planData = planWrapper.data;
        let extractedDays: WorkoutDay[] = [];

        // Normalize Data Structure
        if (planData.weeks && Array.isArray(planData.weeks) && planData.weeks.length > 0) {
           extractedDays = planData.weeks.flatMap((w: any) => w.days || []);
        } else if (planData.days && Array.isArray(planData.days)) {
           extractedDays = planData.days;
        }

        setPlan(planData as TrainingPlan);
        setDays(extractedDays);

        // --- THE FIX IS HERE ---
        // We only fetch logs created AFTER the plan was created.
        const { data: logs } = await supabase
          .from('workout_logs')
          .select('workout_day_index, created_at')
          .eq('user_id', user.id)
          .gte('created_at', planWrapper.created_at) // <--- Only show logs for THIS plan
          .order('created_at', { ascending: false });

        if (logs) {
            const logMap: Record<number, string> = {};
            logs.forEach(log => {
                // Only store the latest date for each index
                if (!logMap[log.workout_day_index]) {
                    logMap[log.workout_day_index] = log.created_at;
                }
            });
            setLastLogs(logMap);
        } else {
            setLastLogs({});
        }
      } else {
        setPlan(null);
        setDays([]);
        setLastLogs({});
      }
    } catch (e) {
      console.error("Dashboard Fetch Error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const addNewDay = async () => {
    if (!plan) return;
    setAddingDay(true);

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if(!user) throw new Error("User not authenticated");

        const newDay: WorkoutDay = {
            day_name: `New Workout`,
            focus: 'Custom Focus',
            exercises: []
        };

        const updatedPlanData: any = JSON.parse(JSON.stringify(plan));
        
        if (updatedPlanData.weeks && Array.isArray(updatedPlanData.weeks)) {
             if (updatedPlanData.weeks.length === 0) {
                 updatedPlanData.weeks.push({ week_number: 1, days: [] });
             }
             if (!updatedPlanData.weeks[0].days) {
                 updatedPlanData.weeks[0].days = [];
             }
             updatedPlanData.weeks[0].days.push(newDay);
        } else {
             if (!updatedPlanData.days) updatedPlanData.days = [];
             updatedPlanData.days.push(newDay);
             delete updatedPlanData.weeks; 
        }

        const { error } = await supabase
            .from('plans')
            .update({ data: updatedPlanData })
            .eq('user_id', user.id)
            .eq('active', true);

        if (error) {
            console.error("Supabase Error:", error);
            throw new Error("Database update failed.");
        }

        await fetchActivePlan();

        setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
        }, 300);
        
    } catch (e: any) {
        Alert.alert("Error Adding Day", e.message);
    } finally {
        setAddingDay(false);
    }
  };

  const deleteDay = (indexToDelete: number) => {
    Alert.alert("Delete Workout?", "This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        { 
            text: "Delete", 
            style: "destructive", 
            onPress: async () => {
                if (!plan) return;
                
                const previousDays = [...days];
                const updatedDays = days.filter((_, i) => i !== indexToDelete);
                setDays(updatedDays);

                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if(!user) return;

                    const updatedPlanData: any = JSON.parse(JSON.stringify(plan));

                    if (updatedPlanData.weeks && Array.isArray(updatedPlanData.weeks) && updatedPlanData.weeks.length > 0) {
                        const currentDays = updatedPlanData.weeks[0].days || [];
                        if (indexToDelete < currentDays.length) {
                             currentDays.splice(indexToDelete, 1);
                             updatedPlanData.weeks[0].days = currentDays;
                        }
                    } else {
                        if (updatedPlanData.days && indexToDelete < updatedPlanData.days.length) {
                            updatedPlanData.days.splice(indexToDelete, 1);
                        }
                    }

                    const { error } = await supabase
                        .from('plans')
                        .update({ data: updatedPlanData })
                        .eq('user_id', user.id)
                        .eq('active', true);
                    
                    if (error) throw error;
                    setPlan(updatedPlanData);

                } catch (e: any) {
                    Alert.alert("Error", "Could not delete day.");
                    console.error(e);
                    setDays(previousDays);
                }
            }
        }
    ]);
  };

  const createManualPlan = async (daysCount: number) => {
    setLoading(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const emptyDays = Array.from({ length: daysCount }, (_, i) => ({
            day_name: `Day ${i + 1}`,
            focus: "Custom Focus",
            exercises: [] 
        }));

        const newPlan = { goal: "Custom Plan", days: emptyDays };

        const { error } = await supabase.from('plans').insert({
            user_id: user.id,
            active: true,
            data: newPlan
        });

        if (error) throw error;
        await fetchActivePlan();
        
    } catch (e: any) {
        Alert.alert("Error", e.message);
        setLoading(false);
    }
  };

  const promptManualPlan = () => {
    Alert.alert("Create Custom Plan", "How many days/week?", [
        { text: "3 Days", onPress: () => createManualPlan(3) },
        { text: "4 Days", onPress: () => createManualPlan(4) },
        { text: "Cancel", style: "cancel" }
    ]);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchActivePlan();
  };

  if (loading && !refreshing) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;

  if (!plan || days.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="barbell-outline" size={64} color="#ccc" style={{ marginBottom: 20 }} />
        <Text style={styles.emptyTitle}>No Active Plan</Text>
        <Text style={styles.emptySubtitle}>Start your journey.</Text>
        <TouchableOpacity style={styles.aiButton} onPress={() => router.push('/onboarding')}>
          <Ionicons name="sparkles" size={20} color="#fff" style={{marginRight: 10}} />
          <Text style={styles.aiBtnText}>Generate with AI</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.manualButton} onPress={promptManualPlan}>
          <Ionicons name="construct-outline" size={20} color="#007AFF" style={{marginRight: 10}} />
          <Text style={styles.manualBtnText}>Build Manually</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
            <Text style={styles.greeting}>Your Routine</Text>
            <Text style={styles.header}>Templates</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
             <Ionicons name="person-circle-outline" size={36} color="#333" />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={days}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item, index }) => {
            const lastDate = lastLogs[index];
            return (
              <View style={styles.dayCard}>
                <TouchableOpacity 
                    style={styles.cardContent}
                    activeOpacity={0.7}
                    onPress={() => router.push({ pathname: '/(tabs)/log', params: { workoutIndex: index, sessionID: Date.now() } })}
                >
                    <View style={styles.textBlock}>
                        <Text style={styles.dayName}>{item.day_name || `Day ${index + 1}`}</Text>
                        <Text style={styles.focusText}>{item.focus || "General"}</Text>
                        <View style={styles.metaRow}>
                            <Text style={styles.metaText}>{item.exercises?.length || 0} Exercises</Text>
                            {lastDate && <Text style={styles.lastLogText}> • Last: {new Date(lastDate).toLocaleDateString()}</Text>}
                        </View>
                    </View>
                    <View style={styles.playIcon}>
                        <Ionicons name="play" size={20} color="#007AFF" style={{marginLeft: 2}}/>
                    </View>
                </TouchableOpacity>

                <View style={styles.actionRow}>
                    <TouchableOpacity 
                        style={styles.editBtn}
                        onPress={() => router.push({ pathname: '/plan/edit', params: { dayIndex: index } })}
                    >
                        <Ionicons name="pencil-outline" size={14} color="#666" />
                        <Text style={styles.editText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.editBtn, { backgroundColor: '#fff0f0', marginLeft: 10 }]}
                        onPress={() => deleteDay(index)}
                    >
                        <Ionicons name="trash-outline" size={14} color="#ff3b30" />
                        <Text style={[styles.editText, { color: '#ff3b30' }]}>Delete</Text>
                    </TouchableOpacity>
                </View>
              </View>
            );
        }}
        ListFooterComponent={
            <TouchableOpacity style={styles.addDayBtn} onPress={addNewDay} disabled={addingDay}>
                {addingDay ? <ActivityIndicator color="#007AFF" /> : <Ionicons name="add" size={20} color="#007AFF" />}
                <Text style={styles.addDayText}>{addingDay ? "Saving..." : "Add New Workout Day"}</Text>
            </TouchableOpacity>
        }
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f9', paddingHorizontal: 20, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 14, color: '#666', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  header: { fontSize: 32, fontWeight: '800', color: '#1c1c1e' },
  dayCard: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 3 },
  cardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  textBlock: { flex: 1 },
  dayName: { fontSize: 18, fontWeight: '700', color: '#1c1c1e', marginBottom: 4 },
  focusText: { fontSize: 14, color: '#007AFF', fontWeight: '600', marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 12, color: '#999', fontWeight: '600' },
  lastLogText: { fontSize: 12, color: '#34c759', fontWeight: '600' },
  playIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#eef6ff', justifyContent: 'center', alignItems: 'center' },
  actionRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f5f5f5', paddingTop: 12 },
  editBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  editText: { fontSize: 12, fontWeight: '600', color: '#666', marginLeft: 4 },
  addDayBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, borderWidth: 2, borderColor: '#eef6ff', borderRadius: 16, borderStyle: 'dashed', marginTop: 10, marginBottom: 20 },
  addDayText: { fontSize: 16, fontWeight: '700', color: '#007AFF', marginLeft: 8 },
  emptyTitle: { fontSize: 24, fontWeight: '800', color: '#333', marginBottom: 8 },
  emptySubtitle: { fontSize: 16, color: '#888', marginBottom: 30, textAlign: 'center' },
  aiButton: { flexDirection: 'row', backgroundColor: '#000', paddingHorizontal: 30, paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginBottom: 15, width: '80%', justifyContent: 'center' },
  aiBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  manualButton: { flexDirection: 'row', backgroundColor: '#eef6ff', paddingHorizontal: 30, paddingVertical: 16, borderRadius: 14, alignItems: 'center', width: '80%', justifyContent: 'center' },
  manualBtnText: { color: '#007AFF', fontWeight: 'bold', fontSize: 16 }
});