import type {
  PublicStrength,
  StrengthSet,
} from "@/lib/public-workout/strength-data";
export const SHEET_POSITIONS = [
  30.8, 37.05, 43.3, 49.55, 55.8, 62, 68, 73.85, 79.6, 86.05,
];
export type SheetGroup = StrengthSet & {
  key: string;
  name: string;
  count: number;
};

export function sheetGroups(
  exercises: PublicStrength["exercises"],
): SheetGroup[] {
  const groups: SheetGroup[] = [];
  for (const exercise of exercises)
    for (const set of exercise.sets) {
      const key = JSON.stringify([
        exercise.id,
        exercise.name,
        set.weight,
        set.units,
        set.reps,
      ]);
      const previous = groups.at(-1);
      if (previous?.key === key) previous.count += 1;
      else groups.push({ key, name: exercise.name, ...set, count: 1 });
    }
  return groups;
}
