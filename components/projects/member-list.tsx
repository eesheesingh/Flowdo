"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { listMembers, updateMemberRole, removeMember, type MemberWithProfile } from "@/lib/projects/members";
import { InviteMemberDialog } from "./invite-member-dialog";
import { Button } from "@/components/ui/button";

type Role = MemberWithProfile["role"];
const ROLE_LABEL: Record<Role, string> = { OWNER: "Owner", ADMIN: "Admin", MEMBER: "Member", VIEWER: "Viewer" };
const ASSIGNABLE_ROLES: Role[] = ["ADMIN", "MEMBER", "VIEWER"];

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
  const qc = useQueryClient();
  const queryKey = ["project-members", projectId];
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const { data: members = [] } = useQuery({
    queryKey,
    queryFn: async () => (await listMembers(supabase, projectId)).data ?? [],
    initialData: initialMembers,
    // ponytail: without this, the default staleTime:0 triggers an immediate
    // background refetch on every mount, which can replace initialData mid-
    // interaction (observed: a row a user is clicking gets removed by a
    // refetch that resolves during the click). Mutations below still force
    // a fresh fetch via invalidateQueries, which ignores staleTime.
    staleTime: Infinity,
  });
  const isManager = canManage(currentUserRole);

  const invalidate = () => qc.invalidateQueries({ queryKey });
  const changeRole = useMutation({
    mutationFn: (v: { userId: string; role: Role }) => updateMemberRole(supabase, projectId, v.userId, v.role),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (userId: string) => removeMember(supabase, projectId, userId),
    onSuccess: invalidate,
  });

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
          const canEditThisRow = isManager && m.role !== "OWNER";
          return (
            <li key={m.user_id} className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {initials(display)}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block truncate text-sm">{display}</span>
                {m.profile?.full_name && m.profile?.email && (
                  <span className="block truncate text-xs text-muted-foreground">{m.profile.email}</span>
                )}
              </span>
              {canEditThisRow ? (
                <select
                  aria-label={`Role for ${display}`}
                  value={m.role}
                  onChange={(e) => changeRole.mutate({ userId: m.user_id, role: e.target.value as Role })}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {ROLE_LABEL[m.role]}
                </span>
              )}
              {canEditThisRow && (
                <button
                  type="button"
                  aria-label={`Remove ${display}`}
                  onClick={() => remove.mutate(m.user_id)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              )}
            </li>
          );
        })}
        {members.length === 0 && <li className="text-xs text-muted-foreground">No members yet.</li>}
      </ul>
      {isManager && <InviteMemberDialog projectId={projectId} open={inviteOpen} onOpenChange={setInviteOpen} />}
    </section>
  );
}
