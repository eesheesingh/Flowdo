"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { projectSchema, type ProjectInput } from "@/lib/validations/tasks";
import { PROJECT_COLORS } from "@/lib/constants/project-colors";
import { PROJECT_ICONS } from "@/lib/constants/project-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";
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
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-lg bg-background p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">New project</Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                      "h-7 w-7 rounded-full border-2",
                      selectedColor === color.value ? "border-foreground" : "border-transparent"
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
                      "flex h-9 w-9 items-center justify-center rounded-md border",
                      selectedIcon === name ? "border-primary bg-primary/10" : "border-border"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
              <FormError message={errors.icon?.message} />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create project"}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
