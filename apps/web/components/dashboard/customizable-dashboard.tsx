"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, EyeOff, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DashboardWidget {
  id: string;
  title: string;
  render: () => React.ReactNode;
  /** Suggested column span: 1 (third), 2 (two-thirds), 3 (full). */
  span?: 1 | 2 | 3;
}

interface LayoutPref {
  order: string[];
  hidden: string[];
  editing: boolean;
}

const KEY = "stoktakip-dashboard-layout";

function loadLayout(): LayoutPref {
  if (typeof window === "undefined") return { order: [], hidden: [], editing: false };
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LayoutPref) : { order: [], hidden: [], editing: false };
  } catch {
    return { order: [], hidden: [], editing: false };
  }
}

function persistLayout(layout: LayoutPref) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(layout));
  } catch {
    /* noop */
  }
}

interface SortableTileProps {
  widget: DashboardWidget;
  editing: boolean;
  hidden: boolean;
  onToggleHidden: (id: string) => void;
}

function SortableTile({ widget, editing, hidden, onToggleHidden }: SortableTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
    disabled: !editing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const span = widget.span ?? 3;

  if (hidden && !editing) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative",
        span === 1 && "lg:col-span-1",
        span === 2 && "lg:col-span-2",
        span === 3 && "lg:col-span-3",
        isDragging && "z-10 opacity-70"
      )}
    >
      {editing && (
        <div className="absolute -top-2 -right-2 z-20 flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7 shadow-sm bg-background"
            onClick={() => onToggleHidden(widget.id)}
            title={hidden ? "Göster" : "Gizle"}
          >
            {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </Button>
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="flex h-7 w-7 cursor-grab items-center justify-center rounded-md border border-border bg-background shadow-sm hover:bg-muted active:cursor-grabbing"
            aria-label="Sürükle"
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      )}
      <div className={cn(editing && "ring-2 ring-primary/30 rounded-xl", hidden && "opacity-40")}>
        {widget.render()}
      </div>
    </div>
  );
}

export interface CustomizableDashboardProps {
  widgets: DashboardWidget[];
  className?: string;
}

/**
 * Draggable / hide-able dashboard. The user clicks "Düzenle" to enter edit
 * mode; layout (order + hidden ids) lives in localStorage.
 */
export function CustomizableDashboard({ widgets, className }: CustomizableDashboardProps) {
  const [layout, setLayout] = useState<LayoutPref>({ order: [], hidden: [], editing: false });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLayout(loadLayout());
    setReady(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const orderedWidgets = useMemo(() => {
    if (!ready) return widgets;
    const orderMap = new Map(layout.order.map((id, i) => [id, i] as const));
    const known = widgets.filter((w) => orderMap.has(w.id));
    const unknown = widgets.filter((w) => !orderMap.has(w.id));
    known.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
    return [...known, ...unknown];
  }, [widgets, layout.order, ready]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedWidgets.findIndex((w) => w.id === active.id);
    const newIndex = orderedWidgets.findIndex((w) => w.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(orderedWidgets, oldIndex, newIndex).map((w) => w.id);
    update({ order: next });
  };

  const update = (patch: Partial<LayoutPref>) => {
    setLayout((prev) => {
      const next = { ...prev, ...patch };
      persistLayout(next);
      return next;
    });
  };

  const toggleHidden = (id: string) => {
    update({
      hidden: layout.hidden.includes(id)
        ? layout.hidden.filter((x) => x !== id)
        : [...layout.hidden, id],
    });
  };

  const reset = () => {
    update({ order: [], hidden: [] });
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-end gap-2">
        {layout.editing && (
          <>
            <span className="text-xs text-muted-foreground">
              {layout.hidden.length} gizli, sürükle-bırak ile sırala
            </span>
            <Button size="sm" variant="ghost" onClick={reset}>
              Sıfırla
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant={layout.editing ? "default" : "outline"}
          onClick={() => update({ editing: !layout.editing })}
        >
          {layout.editing ? "Tamam" : "Panoyu Düzenle"}
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={orderedWidgets.map((w) => w.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {orderedWidgets.map((w) => (
              <SortableTile
                key={w.id}
                widget={w}
                editing={layout.editing}
                hidden={layout.hidden.includes(w.id)}
                onToggleHidden={toggleHidden}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
