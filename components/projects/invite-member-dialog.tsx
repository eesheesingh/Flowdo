"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { inviteMemberByEmail } from "@/lib/projects/members";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Database } from "@/types/database";

type MemberRole = Database["flowdo"]["Tables"]["project_members"]["Row"]["role"];

export function InviteMemberDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const supabase = createClient();
  const qc = useQueryClient();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<MemberRole>("MEMBER");

  const invite = useMutation({
    mutationFn: () => inviteMemberByEmail(supabase, projectId, email.trim(), role),
    onSuccess: (r) => {
      if (!r.error) {
        setEmail("");
        qc.invalidateQueries({ queryKey: ["project-members", projectId] });
        onOpenChange(false);
      }
    },
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-lg bg-background p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">Invite a member</Dialog.Title>
            <Dialog.Close aria-label="Close">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Input
            autoFocus
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@example.com"
          />
          <select
            aria-label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="ADMIN">Admin</option>
            <option value="MEMBER">Member</option>
            <option value="VIEWER">Viewer</option>
          </select>
          {invite.data?.error && (
            <p role="alert" className="text-xs text-destructive">
              {invite.data.error}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="button" disabled={!email.trim() || invite.isPending} onClick={() => invite.mutate()}>
              Send invite
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
