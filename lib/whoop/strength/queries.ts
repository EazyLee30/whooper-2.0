// Keep private API fields/units intact. Cardio details contain exercise aggregates;
// individual reps/weights live in exercise_history, not in the carousel.
export type StrengthGetter = <T = unknown>(path: string, params?: Record<string, string>) => Promise<T>;
type Workout = Record<string, unknown> & { id: string; sport_name?: string };
export async function listStrengthWorkouts(get: StrengthGetter, params: Record<string, string>) {
  const page = await get<{ records?: Workout[]; next_token?: string | null }>('/developer/v2/activity/workout', params);
  const records = (page.records ?? []).filter(workout => /weight|strength|powerlift/i.test(workout.sport_name ?? ''));
  return { items: records, nextCursor: page.next_token || null,
    note: 'Filtered one WHOOP workout page. Follow nextCursor even when items is empty. Use get_strength_workout for exercise aggregates and get_strength_exercise for individual sets.' };
}
export function strengthWorkout(get: StrengthGetter, workoutId: string) {
  return get('/core-details-bff/v1/cardio-details', { activityId: workoutId });
}
export async function strengthExercise(get: StrengthGetter, exerciseId: string) {
  const id = encodeURIComponent(exerciseId);
  const exercise = await get(`/weightlifting-service/v1/exercise/${id}`);
  const history = await get(`/weightlifting-service/v3/exercise/${id}/exercise_history`);
  const personalRecords = await get(`/weightlifting-service/v3/exercise/${id}/personal_records`);
  return { exercise, history, personal_records: personalRecords };
}
