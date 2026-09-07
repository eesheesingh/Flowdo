import { z } from "zod";

export const recurrenceRuleSchema = z.object({
  interval: z.number().int().positive(),
  unit: z.enum(["day", "week", "month", "year"]),
});

export const taskSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required"),
    description: z.string().trim().optional(),
    dueDate: z.string().optional().nullable(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    projectId: z.string().uuid().optional().nullable(),
    recurrence: z.enum(["NEVER", "DAILY", "WEEKLY", "MONTHLY", "YEARLY", "CUSTOM"]).optional(),
    recurrenceRule: recurrenceRuleSchema.optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.recurrence === "CUSTOM" && !val.recurrenceRule) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["recurrenceRule"], message: "Set a repeat interval" });
    }
    if (val.recurrence && val.recurrence !== "NEVER" && !val.dueDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["recurrence"], message: "Add a due date to repeat this task" });
    }
  });
export type TaskInput = z.infer<typeof taskSchema>;

export const projectSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().optional(),
  color: z.string().min(1, "Pick a color"),
  icon: z.string().min(1, "Pick an icon"),
});
export type ProjectInput = z.infer<typeof projectSchema>;

export const labelSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  color: z.string().min(1, "Pick a colour"),
});
export type LabelInput = z.infer<typeof labelSchema>;
