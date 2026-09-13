"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { listMembers, type MemberWithProfile } from "@/lib/projects/members";
import { InviteMemberDialog } from "./invite-member-dialog";
import { Button } from "@/components/ui/button";

type Role = MemberWithProfile["role"];
const ROLE_LABEL: Record<Role, string> = { OWNER: "Owner", ADMIN: "Admin", MEMBER: "Member", VIEWER: "Viewer" };

function initials(nameOrEmail: string): string {
  return nameOrEmail.trim().slice(0, 1).toUpperCase();
}
function canManage(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function MemberList({
  projectId,
  initialMembers,
  currentUserRole,
}: {
  projectId: string;
  initialMembers: MemberWithProfile[];
  currentUserRole: Role;
}) {
  const supabase = createClient();
  const queryKey = ["project-members", projectId];
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const { data: members = [] } = useQuery({
    queryKey,
    queryFn: async () => (await listMembers(supabase, projectId)).data ?? [],
    initialData: initialMembers,
  });
  const isManager = canManage(currentUserRole);

  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Members</h3>
        {isManager && (
          <Button type="button" size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
            Invite member
          </Button>
        )}
      </div>
      <ul className="space-y-2">
        {members.map((m) => {
          const display = m.profile?.full_name || m.profile?.email || m.user_id;
          return (
            <li key={m.user_id} className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {initials(display)}
              </span>
              <span className="flex-1 truncate text-sm">{display}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {ROLE_LABEL[m.role]}
              </span>
            </li>
          );
        })}
        {members.length === 0 && <li className="text-xs text-muted-foreground">No members yet.</li>}
      </ul>
      {isManager && <InviteMemberDialog projectId={projectId} open={inviteOpen} onOpenChange={setInviteOpen} />}
    </section>
  );
}
