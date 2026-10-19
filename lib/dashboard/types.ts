import type { PublicStrength } from '@/lib/public-workout/strength-data';
import type { TemplateId } from '@/lib/presentation';

export type { TemplateId } from '@/lib/presentation';

export type WorkoutSummary = {
  id: string;
  date: string;
  start: string;
  end: string;
  name: string;
  durationMin: number;
  strain: number | null;
  calories: number | null;
};

export type DashboardData = {
  timezone: string;
  date: string;
  connectionStatus: 'active' | 'not_connected' | 'reauth_required';
  strengthConnected: boolean;
  workouts: WorkoutSummary[];
  metrics: { recovery: number | null; sleepHours: number | null; strain: number | null; hrv: number | null; restingHr: number | null };
  week: { date: string; trained: boolean | null; strain: number | null }[];
  updatedAt: string | null;
  notice?: string;
};

export type ShareSnapshot = { version: 1; title: string; workout: WorkoutSummary; strength: PublicStrength | null };
export type ShareRecord = {
  id: string;
  token: string;
  template: TemplateId;
  theme: string;
  title: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
};
