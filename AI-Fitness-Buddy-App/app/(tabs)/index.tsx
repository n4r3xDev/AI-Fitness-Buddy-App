import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { TrainingPlan, TrainingWeek, WorkoutDay } from '../../types';

export default function DashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
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

      const { data: planWrapper } = await supabase
        .from('plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (planWrapper) {
        let planData = planWrapper.data;
        let weeks: TrainingWeek[] = [];

        if (planData.weeks && Array.isArray(planData.weeks)) {
           weeks = planData.weeks;
        } else if (planData.days && Array.isArray(planData.days)) {
           weeks = [{ week_number: 1, days: planData.days }];
        }
        
        const allDays = weeks.flatMap((w) => w.days || []);
        setPlan(planData as TrainingPlan);
        setDays(allDays);

        // Fetch logs (Keep existing logic)
        const { data: logs } = await supabase
          .from('workout_logs')
          .select('workout_day_index, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (logs) {
            const logMap: Record<number, string> = {};
            logs.forEach(log => {
                if (!logMap[log.workout_day_index]) {
                    logMap[log.workout_day_index] = log.created_at;
                }
            });
            setLastLogs(logMap);
        }
      } else {
        setPlan(null);
        setDays([]);
      }
    } catch (e) {
      console.error("Dashboard Error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const createManualPlan = async (daysCount: number) => {
    setLoading(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Create empty days
        const emptyDays = Array.from({ length: daysCount }, (_, i) => ({
            day_name: `Day ${i + 1}`,
            focus: "Custom Focus",
            exercises: [] // Empty!
        }));

        const newPlan = {
            goal: "Custom Plan",
            days: emptyDays
        };

        const { error } = await supabase.from('plans').insert({
            user_id: user.id,
            active: true,
            data: newPlan
        });

        if (error) throw error;
        
        // Refresh to show the new empty plan
        fetchActivePlan();
        
    } catch (e: any) {
        Alert.alert("Error", e.message);
        setLoading(false);
    }
  };

  const promptManualPlan = () => {
    Alert.alert(
        "Create Custom Plan",
        "How many days per week do you want to train?",
        [
            { text: "3 Days", onPress: () => createManualPlan(3) },
            { text: "4 Days", onPress: () => createManualPlan(4) },
            { text: "5 Days", onPress: () => createManualPlan(5) },
            { text: "Cancel", style: "cancel" }
        ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchActivePlan();
  };

  if (loading && !refreshing) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;
  }

  // --- EMPTY STATE (Two Options) ---
  if (!plan || days.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="barbell-outline" size={64} color="#ccc" style={{ marginBottom: 20 }} />
        <Text style={styles.emptyTitle}>No Active Plan</Text>
        <Text style={styles.emptySubtitle}>Choose how you want to start.</Text>

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

  // --- ACTIVE PLAN STATE ---
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
            <Text style={styles.greeting}>Your Routine</Text>
            <Text style={styles.header}>Workout Templates</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
             <Ionicons name="person-circle-outline" size={36} color="#333" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={days}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item, index }) => {
            const lastDate = lastLogs[index];
            
            return (
              <View style={styles.dayCard}>
                <TouchableOpacity 
                    style={styles.cardContent}
                    activeOpacity={0.7}
                    onPress={() => {
                        router.push({
                            pathname: '/(tabs)/log',
                            params: { workoutIndex: index, sessionID: Date.now() } 
                        });
                    }}
                >
                    <View style={styles.textBlock}>
                        <Text style={styles.dayName}>{item.day_name || `Day ${index + 1}`}</Text>
                        <Text style={styles.focusText}>{item.focus || "General Fitness"}</Text>
                        
                        <View style={styles.metaRow}>
                            <Ionicons name="barbell-outline" size={12} color="#999" />
                            <Text style={styles.metaText}> {item.exercises?.length || 0} Exercises</Text>
                            {lastDate && (
                                <>
                                    <Text style={styles.dot}>•</Text>
                                    <Text style={styles.lastLogText}>Last: {new Date(lastDate).toLocaleDateString()}</Text>
                                </>
                            )}
                        </View>
                    </View>
                    
                    <View style={styles.playIcon}>
                        <Ionicons name="play" size={20} color="#007AFF" style={{marginLeft: 2}}/>
                    </View>
                </TouchableOpacity>

                {/* EDIT BUTTON */}
                <TouchableOpacity 
                    style={styles.editBtn}
                    onPress={() => router.push({ pathname: '/plan/edit', params: { dayIndex: index } })}
                >
                     <Ionicons name="pencil-outline" size={16} color="#666" />
                     <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
              </View>
            );
        }}
        contentContainerStyle={{ paddingBottom: 40 }}
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

  dayCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 16,
    padding: 20,
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 3,
    position: 'relative'
  },
  
  cardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  textBlock: { flex: 1 },
  dayName: { fontSize: 18, fontWeight: '700', color: '#1c1c1e', marginBottom: 4 },
  focusText: { fontSize: 14, color: '#007AFF', fontWeight: '600', marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 12, color: '#999', fontWeight: '600' },
  dot: { marginHorizontal: 6, color: '#ccc' },
  lastLogText: { fontSize: 12, color: '#34c759', fontWeight: '600' },
  
  playIcon: { 
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#eef6ff', 
    justifyContent: 'center', alignItems: 'center' 
  },

  // Edit Button Styles
  editBtn: { 
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: '#f5f5f5', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8
  },
  editText: { fontSize: 12, fontWeight: '600', color: '#666', marginLeft: 4 },
  
  // Empty State Styles
  emptyTitle: { fontSize: 24, fontWeight: '800', color: '#333', marginBottom: 8 },
  emptySubtitle: { fontSize: 16, color: '#888', marginBottom: 30, textAlign: 'center' },
  
  aiButton: { 
    flexDirection: 'row', backgroundColor: '#000', paddingHorizontal: 30, paddingVertical: 16, borderRadius: 14, 
    alignItems: 'center', marginBottom: 15, width: '80%', justifyContent: 'center'
  },
  aiBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  
  manualButton: { 
    flexDirection: 'row', backgroundColor: '#eef6ff', paddingHorizontal: 30, paddingVertical: 16, borderRadius: 14, 
    alignItems: 'center', width: '80%', justifyContent: 'center' 
  },
  manualBtnText: { color: '#007AFF', fontWeight: 'bold', fontSize: 16 }
});