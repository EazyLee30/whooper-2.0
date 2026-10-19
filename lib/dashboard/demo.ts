import type { DashboardData } from '@/lib/dashboard/types';
import type { PublicStrength } from '@/lib/public-workout/strength-data';

// Explicitly illustrative, fixed data. Never use as a fallback for a connected account.
export const DEMO_STRENGTH: PublicStrength = {
  fetched_at: '2026-10-19T04:00:00.000Z',
  date: '2026-10-19',
  timezone: 'Asia/Shanghai',
  activity_id: 'demo-strength-1',
  duration_min: 58,
  strain: 12.4,
  total_volume_kg: 5446,
  exercise_count: 5,
  set_count: 17,
  exercises: [
    { id: 'bench_press', name: 'Barbell bench press', sets: [
      { reps: 12, weight: 20, units: 'kg' },
      { reps: 10, weight: 50, units: 'kg' },
      { reps: 8, weight: 60, units: 'kg' },
      { reps: 8, weight: 60, units: 'kg' },
    ] },
    { id: 'squat', name: 'Barbell back squat', sets: [
      { reps: 10, weight: 60, units: 'kg' },
      { reps: 8, weight: 80, units: 'kg' },
      { reps: 8, weight: 80, units: 'kg' },
    ] },
    { id: 'pull_up', name: 'Pull-up', sets: [
      { reps: 8, weight: 0, units: 'kg' },
      { reps: 8, weight: 0, units: 'kg' },
      { reps: 6, weight: 0, units: 'kg' },
    ] },
    { id: 'seated_row', name: 'Seated cable row', sets: [
      { reps: 12, weight: 40, units: 'kg' },
      { reps: 12, weight: 40, units: 'kg' },
      { reps: 10, weight: 45, units: 'kg' },
    ] },
    { id: 'bicep_curl', name: 'Dumbbell bicep curl', sets: [
      { reps: 12, weight: 10, units: 'kg' },
      { reps: 12, weight: 10, units: 'kg' },
      { reps: 10, weight: 12, units: 'kg' },
      { reps: 8, weight: 12, units: 'kg' },
    ] },
  ],
};

export const DEMO_DASHBOARD: DashboardData = {
  timezone: 'Asia/Shanghai',
  date: '2026-10-19',
  connectionStatus: 'not_connected',
  strengthConnected: false,
  workouts: [
    { id: 'demo-strength-1', date: '2026-10-19', start: '2026-10-19T02:00:00.000Z', end: '2026-10-19T02:58:00.000Z', name: 'Strength training', durationMin: 58, strain: 12.4, calories: 386 },
    { id: 'demo-cardio-1', date: '2026-10-18', start: '2026-10-18T00:30:00.000Z', end: '2026-10-18T01:12:00.000Z', name: 'Running', durationMin: 42, strain: 11.8, calories: 412 },
    { id: 'demo-strength-2', date: '2026-10-17', start: '2026-10-17T10:00:00.000Z', end: '2026-10-17T10:51:00.000Z', name: 'Strength training', durationMin: 51, strain: 11.2, calories: 328 },
    { id: 'demo-cardio-2', date: '2026-10-15', start: '2026-10-15T00:00:00.000Z', end: '2026-10-15T00:35:00.000Z', name: 'Cycling', durationMin: 35, strain: 9.3, calories: 264 },
    { id: 'demo-strength-3', date: '2026-10-14', start: '2026-10-14T10:00:00.000Z', end: '2026-10-14T10:54:00.000Z', name: 'Strength training', durationMin: 54, strain: 12.1, calories: 361 },
  ],
  metrics: { recovery: 82, sleepHours: 7.8, strain: 12.4, hrv: 64, restingHr: 52 },
  week: [
    { date: '2026-10-13', trained: false, strain: 5.4 },
    { date: '2026-10-14', trained: true, strain: 12.1 },
    { date: '2026-10-15', trained: true, strain: 9.3 },
    { date: '2026-10-16', trained: false, strain: 4.2 },
    { date: '2026-10-17', trained: true, strain: 11.2 },
    { date: '2026-10-18', trained: true, strain: 11.8 },
    { date: '2026-10-19', trained: true, strain: 12.4 },
  ],
  updatedAt: '2026-10-19T04:00:00.000Z',
  notice: '演示数据 · 不代表任何用户的真实记录',
};
