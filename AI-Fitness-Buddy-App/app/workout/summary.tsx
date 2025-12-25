// app/workout/summary.tsx
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock, Dumbbell, Share2, TrendingUp, Trophy } from 'lucide-react-native';
import React from 'react';
import { ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function WorkoutSummaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const workoutName = params.workoutName as string;
  const durationSeconds = Number(params.durationSeconds) || 0;
  const totalVolume = Number(params.totalVolume) || 0;
  const totalWorkouts = Number(params.totalWorkouts) || 1;
  const prCount = Number(params.prCount) || 0;

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const handleShare = async () => {
    await Share.share({
      message: `I just finished ${workoutName} in ${formatTime(durationSeconds)}! Volume: ${totalVolume}kg 💪`,
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Trophy size={64} color="#FBBF24" style={{ marginBottom: 16 }} />
          <Text style={styles.title}>Workout Complete!</Text>
          <Text style={styles.subtitle}>{workoutName}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Workout #{totalWorkouts}</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Clock size={24} color="#60A5FA" />
            <Text style={styles.statLabel}>Duration</Text>
            <Text style={styles.statValue}>{formatTime(durationSeconds)}</Text>
          </View>
          <View style={styles.statCard}>
            <Dumbbell size={24} color="#A78BFA" />
            <Text style={styles.statLabel}>Volume</Text>
            <Text style={styles.statValue}>{totalVolume.toLocaleString()} kg</Text>
          </View>
        </View>

        {prCount > 0 && (
          <View style={styles.highlightCard}>
            <LinearGradient colors={['#1F2937', '#111827']} style={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TrendingUp size={24} color="#4ADE80" />
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.highlightTitle}>New Records!</Text>
                  <Text style={styles.highlightDesc}>You set {prCount} new Personal Records.</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Share2 size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 8 }}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.doneButton} 
          onPress={() => router.navigate('/(tabs)')} // Go back home
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>Finish</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', paddingTop: 60 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100, alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 18, color: '#9CA3AF', marginBottom: 16 },
  badge: { backgroundColor: '#374151', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { color: '#F3F4F6', fontWeight: '600' },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 20 },
  statCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, width: '48%', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  statLabel: { color: '#94A3B8', marginTop: 8, fontSize: 14 },
  statValue: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginVertical: 4 },
  highlightCard: { width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderColor: '#4ADE80' },
  highlightTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  highlightDesc: { color: '#D1D5DB', fontSize: 14 },
  footer: { position: 'absolute', bottom: 30, left: 20, right: 20, flexDirection: 'row', gap: 12 },
  shareButton: { flex: 1, backgroundColor: '#374151', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12 },
  doneButton: { flex: 2, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12 },
});