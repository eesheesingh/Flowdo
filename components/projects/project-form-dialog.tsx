"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectSchema, type ProjectInput } from "@/lib/validations/tasks";
import { PROJECT_COLORS } from "@/lib/constants/project-colors";
import { PROJECT_ICONS } from "@/lib/constants/project-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function ProjectFormDialog({
  trigger,
  onCreate,
}: {
  trigger: React.ReactNode;
  onCreate: (input: ProjectInput) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema),
    defaultValues: { color: PROJECT_COLORS[0]!.value, icon: PROJECT_ICONS[0]!.name },
  });

  const selectedColor = watch("color");
  const selectedIcon = watch("icon");

  async function onSubmit(values: ProjectInput) {
    await onCreate(values);
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogTitle>New list</DialogTitle>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register("name")} />
            <FormError message={errors.name?.message} />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  aria-label={color.name}
                  onClick={() => setValue("color", color.value)}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-transform",
                    selectedColor === color.value ? "border-on-surface scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: color.value }}
                />
              ))}
            </div>
            <FormError message={errors.color?.message} />
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_ICONS.map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  type="button"
                  aria-label={name}
                  onClick={() => setValue("icon", name)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                    selectedIcon === name
                      ? "bg-secondary-container text-on-secondary-fixed-variant"
                      : "bg-surface-container text-on-surface-variant hover:bg-surface-high"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
            <FormError message={errors.icon?.message} />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create list"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
