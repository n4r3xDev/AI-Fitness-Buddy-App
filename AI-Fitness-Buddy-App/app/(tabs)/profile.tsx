import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

  // --- NICKNAME/AVATAR STATE ---
  const [isEditingName, setIsEditingName] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // --- NEW: PHYSICAL DETAILS EDIT STATE ---
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [editForm, setEditForm] = useState({
      age: '',
      gender: '',
      height: '',
      weight: ''
  });

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
      
      if (profileData) {
        setProfile(profileData);
        setNewNickname(profileData.nickname || '');
        
        // Prepare edit form with existing data
        setEditForm({
            age: profileData.age ? String(profileData.age) : '',
            gender: profileData.gender || '',
            height: profileData.height ? String(profileData.height) : '',
            weight: profileData.weight ? String(profileData.weight) : '',
        });
        
        if (profileData.avatar_url) {
            const { data } = supabase.storage.from('avatars').getPublicUrl(profileData.avatar_url);
            setAvatarUrl(data.publicUrl);
        }
      }

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

  // --- AVATAR & PROFILE LOGIC ---
  const handlePickImage = async () => {
    try {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled && result.assets[0].base64) {
            uploadAvatar(result.assets[0].base64);
        }
    } catch (e) {
        Alert.alert("Error", "Could not pick image");
    }
  };

  const uploadAvatar = async (base64Image: string) => {
    setUploadingAvatar(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const fileName = `${user.id}/${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, decode(base64Image), { contentType: 'image/jpeg', upsert: true });
        if (uploadError) throw uploadError;
        
        await supabase.from('profiles').update({ avatar_url: fileName }).eq('id', user.id);
        
        const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
        setAvatarUrl(data.publicUrl);
        Alert.alert("Success", "Avatar updated!");
    } catch (e: any) {
        Alert.alert("Upload Failed", e.message);
    } finally {
        setUploadingAvatar(false);
    }
  };

  const saveNickname = async () => {
    if (!newNickname.trim()) { setIsEditingName(false); return; }
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase.from('profiles').update({ nickname: newNickname }).eq('id', user.id);
        setProfile({ ...profile, nickname: newNickname });
        setIsEditingName(false);
    } catch (e: any) {
        Alert.alert("Error", e.message);
    }
  };

  // --- SAVE PHYSICAL DETAILS ---
  const saveDetails = async () => {
    setLoading(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const updates = {
            age: editForm.age ? parseInt(editForm.age) : null,
            weight: editForm.weight ? parseFloat(editForm.weight) : null,
            height: editForm.height ? parseFloat(editForm.height) : null,
            gender: editForm.gender
        };

        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id);

        if (error) throw error;

        setProfile({ ...profile, ...updates });
        setDetailsModalVisible(false);
    } catch (e: any) {
        Alert.alert("Error", e.message);
    } finally {
        setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  };

  const handleDeletePlan = () => {
    Alert.alert("Delete Current Plan?", "You will need to generate a new one.", [
        { text: "Cancel", style: "cancel" },
        { 
            text: "Delete", 
            style: "destructive", 
            onPress: async () => {
                setLoading(true);
                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) return;
                    const { error } = await supabase.from('plans').delete().eq('user_id', user.id);
                    if (error) throw error;
                    Alert.alert("Success", "Plan deleted successfully.");
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

       <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
         <Text style={[styles.sectionTitle, {marginBottom: 0}]}>Profile Details</Text>
         <TouchableOpacity onPress={() => setDetailsModalVisible(true)}>
            <Text style={{color: '#007AFF', fontWeight: '600'}}>Edit Details</Text>
         </TouchableOpacity>
       </View>
       
       <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Age:</Text>
            <Text style={styles.infoValue}>{profile?.age || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Gender:</Text>
            <Text style={styles.infoValue}>{profile?.gender || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Height:</Text>
            <Text style={styles.infoValue}>{profile?.height ? `${profile.height} cm` : '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Weight:</Text>
            <Text style={styles.infoValue}>{profile?.weight ? `${profile.weight} kg` : '-'}</Text>
          </View>
          <View style={[styles.infoRow, {borderBottomWidth: 0}]}>
            <Text style={styles.infoLabel}>Goal:</Text>
            <Text style={styles.infoValue}>{profile?.goal?.replace('_', ' ') || '-'}</Text>
          </View>
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
      {/* HEADER (Avatar + Nickname) */}
      <View style={styles.header}>
        <TouchableOpacity 
            style={[styles.avatar, uploadingAvatar && {opacity: 0.5}]} 
            onPress={handlePickImage}
            disabled={uploadingAvatar}
        >
            {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
                <Text style={styles.avatarText}>{profile?.goal?.[0]?.toUpperCase() || 'U'}</Text>
            )}
            <View style={styles.editBadge}>
                <Ionicons name="camera" size={12} color="#fff" />
            </View>
        </TouchableOpacity>

        <View style={styles.nameContainer}>
            {isEditingName ? (
                <View style={styles.editRow}>
                    <TextInput 
                        value={newNickname}
                        onChangeText={setNewNickname}
                        style={styles.nameInput}
                        placeholder="Nickname"
                        autoFocus
                    />
                    <TouchableOpacity onPress={saveNickname} style={styles.iconBtn}>
                        <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity style={styles.nameRow} onPress={() => setIsEditingName(true)}>
                    <Text style={styles.username}>{profile?.nickname || userEmail}</Text>
                    <Ionicons name="pencil" size={16} color="#999" style={{marginLeft: 8}} />
                </TouchableOpacity>
            )}
        </View>
        <Text style={styles.userTag}>Level {Math.floor(stats.workouts / 5) + 1}</Text>
      </View>

      {/* TAB NAVIGATION */}
      <View style={styles.tabs}>
        {(['stats', 'history', 'settings'] as Tab[]).map((t) => (
            <TouchableOpacity 
                key={t} 
                style={[styles.tab, activeTab === t && styles.activeTab]} 
                onPress={() => setActiveTab(t)}
            >
                <Text style={[styles.tabText, activeTab === t && styles.activeTabText]}>{t.toUpperCase()}</Text>
            </TouchableOpacity>
        ))}
      </View>

      {/* CONTENT */}
      <View style={styles.contentArea}>
        {activeTab === 'stats' && renderStats()}
        {activeTab === 'history' && renderHistory()}
        {activeTab === 'settings' && renderSettings()}
      </View>

      {/* --- DETAILS EDIT MODAL --- */}
      <Modal visible={detailsModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <View style={styles.detailsModalContent}>
                <Text style={styles.modalTitle}>Edit Details</Text>
                
                <Text style={styles.inputLabel}>Age</Text>
                <TextInput 
                    style={styles.modalInput} 
                    value={editForm.age} 
                    onChangeText={(t) => setEditForm({...editForm, age: t})}
                    keyboardType="numeric"
                    placeholder="e.g. 25"
                />

                <Text style={styles.inputLabel}>Gender</Text>
                <TextInput 
                    style={styles.modalInput} 
                    value={editForm.gender} 
                    onChangeText={(t) => setEditForm({...editForm, gender: t})}
                    placeholder="e.g. Male/Female"
                />

                <View style={{flexDirection: 'row', gap: 10}}>
                    <View style={{flex: 1}}>
                        <Text style={styles.inputLabel}>Height (cm)</Text>
                        <TextInput 
                            style={styles.modalInput} 
                            value={editForm.height} 
                            onChangeText={(t) => setEditForm({...editForm, height: t})}
                            keyboardType="numeric"
                            placeholder="180"
                        />
                    </View>
                    <View style={{flex: 1}}>
                        <Text style={styles.inputLabel}>Weight (kg)</Text>
                        <TextInput 
                            style={styles.modalInput} 
                            value={editForm.weight} 
                            onChangeText={(t) => setEditForm({...editForm, weight: t})}
                            keyboardType="numeric"
                            placeholder="80.5"
                        />
                    </View>
                </View>

                <View style={styles.modalButtons}>
                    <TouchableOpacity style={[styles.modalBtn, {backgroundColor: '#f0f0f0'}]} onPress={() => setDetailsModalVisible(false)}>
                        <Text style={{color: '#333'}}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalBtn, {backgroundColor: '#007AFF'}]} onPress={saveDetails}>
                        <Text style={{color: '#fff', fontWeight: '600'}}>Save Changes</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
      </Modal>

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
  header: { alignItems: 'center', paddingVertical: 30, backgroundColor: '#fff', paddingBottom: 20 },
  
  // AVATAR STYLES
  avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#eef6ff', justifyContent: 'center', alignItems: 'center', marginBottom: 15, position: 'relative' },
  avatarImage: { width: 90, height: 90, borderRadius: 45 },
  avatarText: { fontSize: 36, fontWeight: 'bold', color: '#007AFF' },
  editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#007AFF', padding: 6, borderRadius: 15, borderWidth: 2, borderColor: '#fff' },

  // NAME EDITING
  nameContainer: { height: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  username: { fontSize: 20, fontWeight: '800', color: '#1c1c1e' },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameInput: { fontSize: 18, borderBottomWidth: 1, borderBottomColor: '#007AFF', paddingHorizontal: 5, paddingVertical: 2, minWidth: 150, textAlign: 'center' },
  iconBtn: { padding: 5 },

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
  
  // UPDATED INFO BOX STYLES
  infoBox: { backgroundColor: '#fff', borderRadius: 16, padding: 0, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  infoLabel: { fontSize: 15, color: '#666' },
  infoValue: { fontSize: 15, fontWeight: '600', color: '#333', textTransform: 'capitalize' },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  detailsModalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  inputLabel: { fontSize: 12, color: '#666', marginBottom: 5, textTransform: 'uppercase', fontWeight: '600' },
  modalInput: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#eee', marginBottom: 15, fontSize: 16 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  
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

  // --- MODAL STYLES (LOG DETAILS) ---
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
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