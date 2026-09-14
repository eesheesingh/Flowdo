"use client";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, CheckCircle2 } from "lucide-react";
import { TaskRow } from "./task-row";
import { EmptyState } from "@/components/dashboard/empty-state";
import { calculateNewPosition } from "@/lib/tasks/reorder";
import type { Database } from "@/types/database";

type TaskRowData = Database["flowdo"]["Tables"]["tasks"]["Row"];
type LabelChip = { id: string; name: string; color: string };

function SortableTaskRow({
  task,
  onOpen,
  onToggleComplete,
  labels,
  readOnly,
}: {
  task: TaskRowData;
  onOpen: (task: TaskRowData) => void;
  onToggleComplete: (task: TaskRowData) => void;
  labels?: LabelChip[];
  readOnly?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab touch-none text-muted-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1">
        <TaskRow task={task} onOpen={onOpen} onToggleComplete={onToggleComplete} labels={labels} readOnly={readOnly} />
      </div>
    </div>
  );
}

export function TaskList({
  tasks,
  onOpenTask,
  onToggleComplete,
  onReorder,
  emptyTitle,
  emptyDescription,
  labelsByTask,
  readOnly = false,
  groupBy,
}: {
  tasks: TaskRowData[];
  onOpenTask: (task: TaskRowData) => void;
  onToggleComplete: (task: TaskRowData) => void;
  onReorder?: (taskId: string, newPosition: number) => void;
  emptyTitle: string;
  emptyDescription: string;
  labelsByTask?: Map<string, LabelChip[]>;
  readOnly?: boolean;
  /** When provided, renders tasks under a heading per distinct group label instead of one flat list. Ignored when onReorder is set (drag-and-drop needs one flat order). */
  groupBy?: (task: TaskRowData) => string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (tasks.length === 0) {
    return <EmptyState icon={CheckCircle2} title={emptyTitle} description={emptyDescription} />;
  }

  if (!onReorder && groupBy) {
    const groups = new Map<string, TaskRowData[]>();
    for (const task of tasks) {
      const key = groupBy(task);
      groups.set(key, [...(groups.get(key) ?? []), task]);
    }
    return (
      <div className="space-y-6">
        {[...groups.entries()].map(([label, groupTasks]) => (
          <div key={label} className="space-y-2">
            <div className="flex items-baseline justify-between px-1">
              <h3 className="font-serif text-lg text-on-surface">{label}</h3>
              <span className="text-xs text-on-surface-variant">
                {groupTasks.length} {groupTasks.length === 1 ? "task" : "tasks"}
              </span>
            </div>
            <div className="space-y-2">
              {groupTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onOpen={onOpenTask}
                  onToggleComplete={onToggleComplete}
                  labels={labelsByTask?.get(task.id)}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!onReorder) {
    return (
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onOpen={onOpenTask}
            onToggleComplete={onToggleComplete}
            labels={labelsByTask?.get(task.id)}
            readOnly={readOnly}
          />
        ))}
      </div>
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(tasks, oldIndex, newIndex);

    const prevTask = reordered[newIndex - 1];
    const nextTask = reordered[newIndex + 1];
    const newPosition = calculateNewPosition(prevTask?.position ?? null, nextTask?.position ?? null);

    onReorder!(String(active.id), newPosition);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {tasks.map((task) => (
            <SortableTaskRow
              key={task.id}
              task={task}
              onOpen={onOpenTask}
              onToggleComplete={onToggleComplete}
              labels={labelsByTask?.get(task.id)}
              readOnly={readOnly}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
