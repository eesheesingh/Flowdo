import { z } from "zod";

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  projectId: z.string().uuid().optional().nullable(),
});
export type TaskInput = z.infer<typeof taskSchema>;

export const projectSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().optional(),
  color: z.string().min(1, "Pick a color"),
  icon: z.string().min(1, "Pick an icon"),
});
export type ProjectInput = z.infer<typeof projectSchema>;
