import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { TrainingPlan, TrainingWeek, WorkoutDay } from '../../types';

export default function DashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [days, setDays] = useState<WorkoutDay[]>([]);
  const [completedDays, setCompletedDays] = useState<Set<number>>(new Set());

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
        // --- 1. Normalize Plan Structure (Defensive Coding) ---
        let planData = planWrapper.data;
        let weeks: TrainingWeek[] = [];

        // Check for "weeks" array (Standard)
        if (planData.weeks && Array.isArray(planData.weeks)) {
           weeks = planData.weeks;
        } 
        // Check for "days" array (Flat fallback)
        else if (planData.days && Array.isArray(planData.days)) {
           weeks = [{ week_number: 1, days: planData.days }];
        }
        
        // Flatten days safely. If 'w.days' is undefined, use empty array []
        const allDays = weeks.flatMap((w) => w.days || []);
        
        setPlan(planData as TrainingPlan);
        setDays(allDays);

        // --- 2. Check Completion Status ---
        const { data: logs } = await supabase
          .from('workout_logs')
          .select('workout_day_index')
          .eq('user_id', user.id)
          .gte('completed_at', planWrapper.created_at);

        if (logs) {
            const completedSet = new Set(logs.map(l => l.workout_day_index));
            setCompletedDays(completedSet);
        }
      }
    } catch (e) {
      console.error("Dashboard Error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchActivePlan();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // If no plan OR if the plan has 0 valid days
  if (!plan || days.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No active plan found.</Text>
        <TouchableOpacity 
          style={styles.createButton} 
          onPress={() => router.push('/onboarding')}>
          <Text style={styles.btnText}>Create New Plan</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
            <Text style={styles.greeting}>Current Schedule</Text>
            <Text style={styles.header}>Your Week</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
             <Ionicons name="person-circle-outline" size={36} color="#333" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={days}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item, index }) => {
            const isDone = completedDays.has(index);
            // Defensive: ensure 'item.exercises' exists before accessing .length
            const exerciseCount = item.exercises?.length || 0;

            return (
              <TouchableOpacity 
                style={[styles.dayCard, isDone && styles.dayCardDone]}
                activeOpacity={0.7}
                onPress={() => router.push({
                    pathname: '/(tabs)/log',
                    params: { workoutIndex: index }
                })}
              >
                <View style={styles.cardContent}>
                    <View style={styles.textBlock}>
                        <Text style={[styles.dayName, isDone && {color: '#888'}]}>
                            {item.day_name || `Day ${index + 1}`}
                        </Text>
                        <Text style={styles.focusText}>
                            {item.focus || "General Fitness"}
                        </Text>
                        <Text style={styles.metaText}>
                            {exerciseCount} Exercises
                        </Text>
                    </View>
                    
                    <View style={[styles.statusIcon, isDone ? styles.iconDone : styles.iconActive]}>
                        <Ionicons 
                            name={isDone ? "checkmark" : "chevron-forward"} 
                            size={20} 
                            color={isDone ? "#fff" : "#007AFF"} 
                        />
                    </View>
                </View>
              </TouchableOpacity>
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
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 3
  },
  dayCardDone: { backgroundColor: '#f0f0f0', shadowOpacity: 0 },
  
  cardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  textBlock: { flex: 1 },
  
  dayName: { fontSize: 18, fontWeight: '700', color: '#1c1c1e', marginBottom: 4 },
  focusText: { fontSize: 14, color: '#007AFF', fontWeight: '600', marginBottom: 8 },
  metaText: { fontSize: 12, color: '#999', fontWeight: '600' },
  
  statusIcon: { 
    width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' 
  },
  iconActive: { backgroundColor: '#eef6ff' },
  iconDone: { backgroundColor: '#34c759' },

  emptyText: { fontSize: 18, color: '#666', marginBottom: 20, fontWeight: 'bold' },
  createButton: { backgroundColor: '#007AFF', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});