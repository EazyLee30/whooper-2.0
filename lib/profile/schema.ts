import { z } from "zod";
export const profileSchema = z
  .object({
    displayName: z.string().trim().max(32),
    gender: z.enum(["hidden", "male", "female", "other"]),
  })
  .strict();
export type ShareProfile = z.infer<typeof profileSchema>;
export const emptyProfile: ShareProfile = { displayName: "", gender: "hidden" };
export const genderLabel = (gender: ShareProfile["gender"]) =>
  ({ hidden: "", male: "M", female: "F", other: "X" })[gender];
