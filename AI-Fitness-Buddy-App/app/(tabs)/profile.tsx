import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList, Modal, SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../../lib/supabase';

type Tab = 'stats' | 'history' | 'settings';

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('stats');
  
  const [userEmail, setUserEmail] = useState("User");
  const [profile, setProfile] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [prs, setPrs] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({ workouts: 0, volume: 0 });

  const [selectedLog, setSelectedLog] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [])
  );

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/(auth)/login');
        return;
      }

      setUserEmail(user.email || "Fitness Buddy");

      // 1. Fetch Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profileData) setProfile(profileData);

      // 2. Fetch History
      const { data: logs } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (logs && logs.length > 0) {
        setHistory(logs);
        calculateStatsAndPRs(logs);
      } else {
        setHistory([]);
      }

    } catch (e) {
      console.error("Profile Load Error:", e);
    } finally {
      setLoading(false);
    }
  };

  const calculateStatsAndPRs = (logs: any[]) => {
    let totalWorkouts = logs.length;
    let totalVolume = 0;
    const bests: Record<string, number> = {};

    logs.forEach(log => {
      const exercises = Array.isArray(log.exercise_data) ? log.exercise_data : [];
      
      exercises.forEach((ex: any) => {
        const name = ex.name ? ex.name.toLowerCase() : '';
        const sets = Array.isArray(ex.sets) ? ex.sets : [];

        sets.forEach((set: any) => {
          const w = parseFloat(set.weight);
          const r = parseFloat(set.reps);
          
          if (!isNaN(w) && !isNaN(r) && w > 0) {
            totalVolume += w * r;

            const e1rm = r === 1 ? w : w * (1 + r / 30);
            const rounded1RM = Math.round(e1rm);

            if (name.includes('bench')) updatePR(bests, 'Bench Press', rounded1RM);
            else if (name.includes('squat')) updatePR(bests, 'Squat', rounded1RM);
            else if (name.includes('deadlift')) updatePR(bests, 'Deadlift', rounded1RM);
            else if (name.includes('overhead') || name.includes('ohp')) updatePR(bests, 'Overhead Press', rounded1RM);
          }
        });
      });
    });

    setStats({ workouts: totalWorkouts, volume: totalVolume });
    setPrs(bests);
  };

  const updatePR = (record: Record<string, number>, key: string, weight: number) => {
    if (!record[key] || weight > record[key]) {
      record[key] = weight;
    }
  };

  // --- ACTIONS ---
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  };

  // --- FIXED DELETE LOGIC ---
  const handleDeletePlan = () => {
    Alert.alert("Delete Current Plan?", "You will need to generate a new one.", [
        { text: "Cancel", style: "cancel" },
        { 
            text: "Delete", 
            style: "destructive", 
            onPress: async () => {
                setLoading(true); // Show loading
                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) return;

                    // Execute Delete
                    const { error } = await supabase
                        .from('plans')
                        .delete()
                        .eq('user_id', user.id);

                    if (error) {
                        throw error;
                    }

                    Alert.alert("Success", "Plan deleted successfully.");
                    // Force navigation to dashboard to reset state
                    router.replace('/(tabs)');
                } catch (e: any) {
                    Alert.alert("Error", e.message || "Failed to delete plan.");
                    setLoading(false);
                }
            }
        }
    ]);
  };

  const handleResetAccount = () => {
    Alert.alert("Reset Everything?", "This will delete ALL history and plans.", [
        { text: "Cancel", style: "cancel" },
        { 
            text: "Wipe Data", 
            style: "destructive", 
            onPress: async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if(user) {
                    setLoading(true);
                    await supabase.from('workout_logs').delete().eq('user_id', user.id);
                    await supabase.from('plans').delete().eq('user_id', user.id);
                    await supabase.from('profiles').delete().eq('id', user.id);
                    await supabase.auth.signOut();
                    router.replace('/(auth)/login');
                }
            }
        }
    ]);
  };

  // --- RENDERERS ---

  const renderStats = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
       <View style={styles.statsRow}>
          <View style={styles.statCard}>
             <Text style={styles.statValue}>{stats.workouts}</Text>
             <Text style={styles.statLabel}>Workouts</Text>
          </View>
          <View style={styles.statCard}>
             <Text style={styles.statValue}>{(stats.volume / 1000).toFixed(1)}k</Text>
             <Text style={styles.statLabel}>Vol (kg)</Text>
          </View>
       </View>

       <Text style={styles.sectionTitle}>Estimated 1RM Records</Text>
       <View style={styles.prContainer}>
          {['Bench Press', 'Squat', 'Deadlift', 'Overhead Press'].map((lift) => (
             <View key={lift} style={styles.prRow}>
                <Text style={styles.prName}>{lift}</Text>
                <Text style={styles.prValue}>{prs[lift] ? `${prs[lift]} kg` : '-'}</Text>
             </View>
          ))}
       </View>

       <Text style={styles.sectionTitle}>Profile Details</Text>
       <View style={styles.infoBox}>
          <Text style={styles.infoText}>Goal: {profile?.goal?.replace('_', ' ') || '-'}</Text>
          <Text style={styles.infoText}>Level: {profile?.experience_level || '-'}</Text>
          <Text style={styles.infoText}>Split: {profile?.split || '-'}</Text>
       </View>
    </ScrollView>
  );

  const renderHistory = () => (
    <FlatList
      data={history}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingBottom: 20 }}
      ListEmptyComponent={<Text style={styles.emptyText}>No workouts yet.</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity 
            style={styles.historyCard} 
            onPress={() => setSelectedLog(item)} 
        >
            <View style={styles.historyHeader}>
                <Text style={styles.historyDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                <View style={styles.historyBadges}>
                    <Text style={styles.historyTime}>
                        {item.notes?.includes('Duration:') ? item.notes.split('Duration: ')[1] : ''}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#ccc" style={{marginLeft: 5}} />
                </View>
            </View>
            <Text style={styles.historyRpe}>
                Avg RPE: {item.rpe} • <Text style={{fontWeight: 'bold', color: item.fatigue_level === 'high' ? 'red' : item.fatigue_level === 'low' ? 'green' : 'orange'}}>
                    {item.fatigue_level?.toUpperCase()}
                </Text> Fatigue
            </Text>
        </TouchableOpacity>
      )}
    />
  );

  const renderSettings = () => (
    <ScrollView style={styles.tabContent}>
        <Text style={styles.sectionTitle}>Plan Management</Text>
        <TouchableOpacity style={styles.settingBtn} onPress={handleDeletePlan}>
            <Ionicons name="trash-outline" size={20} color="#ff3b30" />
            <Text style={[styles.settingText, {color: '#ff3b30'}]}>Delete Current Plan</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={styles.settingBtn} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color="#007AFF" />
            <Text style={styles.settingText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { marginTop: 40, color: '#ff3b30' }]}>Danger Zone</Text>
        <TouchableOpacity style={[styles.settingBtn, styles.dangerBtn]} onPress={handleResetAccount}>
            <Ionicons name="nuclear-outline" size={20} color="#fff" />
            <Text style={[styles.settingText, {color: '#fff', fontWeight: 'bold'}]}>Reset Everything</Text>
        </TouchableOpacity>
        <Text style={styles.dangerDesc}>This will delete your account data, history, and active plan.</Text>
    </ScrollView>
  );

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF"/></View>;

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile?.goal?.[0]?.toUpperCase() || 'U'}</Text>
        </View>
        <Text style={styles.username}>{userEmail}</Text>
        <Text style={styles.userTag}>Level {Math.floor(stats.workouts / 5) + 1}</Text>
      </View>

      <View style={styles.tabs}>
        {(['stats', 'history', 'settings'] as Tab[]).map((t) => (
            <TouchableOpacity 
                key={t} 
                style={[styles.tab, activeTab === t && styles.activeTab]} 
                onPress={() => setActiveTab(t)}
            >
                <Text style={[styles.tabText, activeTab === t && styles.activeTabText]}>
                    {t.toUpperCase()}
                </Text>
            </TouchableOpacity>
        ))}
      </View>

      <View style={styles.contentArea}>
        {activeTab === 'stats' && renderStats()}
        {activeTab === 'history' && renderHistory()}
        {activeTab === 'settings' && renderSettings()}
      </View>

      {/* --- LOG DETAIL MODAL --- */}
      <Modal visible={selectedLog !== null} animationType="slide" presentationStyle="pageSheet">
        {selectedLog && (
            <SafeAreaView style={{flex: 1, backgroundColor: '#f4f6f9'}}>
                <View style={styles.modalHeader}>
                    <View>
                        <Text style={styles.modalTitle}>{new Date(selectedLog.created_at).toLocaleDateString()}</Text>
                        <Text style={styles.modalSubtitle}>Workout Details</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedLog(null)} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color="#333" />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={{padding: 20}}>
                    {/* STATS SUMMARY */}
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Avg RPE</Text>
                            <Text style={styles.summaryValue}>{selectedLog.rpe}/10</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Fatigue</Text>
                            <Text style={[styles.summaryValue, {textTransform: 'capitalize'}]}>{selectedLog.fatigue_level}</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Sets</Text>
                            <Text style={styles.summaryValue}>
                                {selectedLog.exercise_data?.reduce((acc: number, ex: any) => acc + (ex.sets?.length || 0), 0) || 0}
                            </Text>
                        </View>
                    </View>

                    {/* NOTES SECTION */}
                    {selectedLog.notes && (
                        <View style={styles.notesBox}>
                            <Text style={styles.sectionHeader}>Notes</Text>
                            <Text style={styles.notesText}>{selectedLog.notes}</Text>
                        </View>
                    )}

                    {/* EXERCISE LIST */}
                    <Text style={[styles.sectionHeader, {marginTop: 20}]}>Exercises</Text>
                    {selectedLog.exercise_data?.map((ex: any, i: number) => (
                        <View key={i} style={styles.logExerciseCard}>
                            <Text style={styles.logExerciseName}>{ex.name}</Text>
                            
                            <View style={styles.setTable}>
                                <View style={styles.setRowHeader}>
                                    <Text style={[styles.setCell, styles.setHeaderCell]}>Set</Text>
                                    <Text style={[styles.setCell, styles.setHeaderCell]}>Kg</Text>
                                    <Text style={[styles.setCell, styles.setHeaderCell]}>Reps</Text>
                                    <Text style={[styles.setCell, styles.setHeaderCell]}>RPE</Text>
                                </View>
                                {ex.sets?.map((set: any, j: number) => (
                                    <View key={j} style={[styles.setRow, set.type === 'W' && {backgroundColor: '#fffbeb'}]}>
                                        <View style={[styles.setBadge, 
                                            set.type === 'W' ? {backgroundColor: '#fff3cd'} : 
                                            set.type === 'D' ? {backgroundColor: '#e8daff'} : 
                                            set.type === 'F' ? {backgroundColor: '#f8d7da'} : {}
                                        ]}>
                                            <Text style={styles.setBadgeText}>
                                                {set.type === 'N' ? j + 1 : set.type}
                                            </Text>
                                        </View>
                                        <Text style={styles.setCell}>{set.weight || '-'}</Text>
                                        <Text style={styles.setCell}>{set.reps || '0'}</Text>
                                        <Text style={styles.setCell}>{set.rpe || '-'}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </SafeAreaView>
        )}
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', paddingVertical: 40, backgroundColor: '#fff', paddingBottom: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#eef6ff', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: '#007AFF' },
  username: { fontSize: 20, fontWeight: '800', color: '#1c1c1e' },
  userTag: { fontSize: 14, color: '#666', marginTop: 4, backgroundColor: '#f0f0f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 15 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#007AFF' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#999', letterSpacing: 0.5 },
  activeTabText: { color: '#007AFF' },
  contentArea: { flex: 1, padding: 20 },
  tabContent: { flex: 1 },
  statsRow: { flexDirection: 'row', gap: 15, marginBottom: 25 },
  statCard: { flex: 1, backgroundColor: '#fff', padding: 20, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5 },
  statValue: { fontSize: 24, fontWeight: '800', color: '#333' },
  statLabel: { fontSize: 12, color: '#888', textTransform: 'uppercase', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#333' },
  prContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 5, marginBottom: 25 },
  prRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
  prName: { fontSize: 16, color: '#444' },
  prValue: { fontSize: 16, fontWeight: 'bold', color: '#007AFF' },
  infoBox: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  infoText: { fontSize: 15, color: '#555', marginBottom: 8, textTransform: 'capitalize' },
  
  // HISTORY LIST
  historyCard: { backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  historyDate: { fontSize: 16, fontWeight: '700', color: '#333' },
  historyBadges: { flexDirection: 'row', alignItems: 'center' },
  historyTime: { fontSize: 14, color: '#007AFF', fontWeight: '600' },
  historyRpe: { fontSize: 13, color: '#555' },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 50 },
  
  // SETTINGS
  settingBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3 },
  settingText: { fontSize: 16, marginLeft: 12, fontWeight: '500', color: '#333' },
  dangerBtn: { backgroundColor: '#ff3b30' },
  dangerDesc: { fontSize: 12, color: '#999', marginLeft: 5, marginTop: -5 },

  // --- MODAL STYLES ---
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#333' },
  modalSubtitle: { fontSize: 14, color: '#888' },
  closeBtn: { padding: 8, backgroundColor: '#f0f0f0', borderRadius: 20 },
  
  summaryCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 12, color: '#888', marginBottom: 4, textTransform: 'uppercase' },
  summaryValue: { fontSize: 18, fontWeight: '700', color: '#333' },

  notesBox: { backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 20 },
  sectionHeader: { fontSize: 16, fontWeight: '700', marginBottom: 8, color: '#333' },
  notesText: { fontSize: 14, color: '#555', lineHeight: 20 },

  logExerciseCard: { backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 15 },
  logExerciseName: { fontSize: 16, fontWeight: '700', marginBottom: 10, color: '#007AFF' },
  setTable: { gap: 8 },
  setRowHeader: { flexDirection: 'row', marginBottom: 5, paddingHorizontal: 10 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
  setCell: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '600', color: '#444' },
  setHeaderCell: { color: '#999', fontSize: 12, textTransform: 'uppercase' },
  
  setBadge: { width: 30, height: 24, backgroundColor: '#f0f0f0', borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginLeft: 10, marginRight: 10 },
  setBadgeText: { fontSize: 12, fontWeight: '700', color: '#555' }
});