"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface InlineEditCellProps<TValue extends string | number> {
  value: TValue;
  /** Validate input + save. Reject by throwing or returning a rejection. */
  onSave: (next: TValue) => Promise<void> | void;
  /** Render mode for the static display (defaults to plain text). */
  display?: (value: TValue) => React.ReactNode;
  type?: "text" | "number";
  inputMode?: "decimal" | "numeric" | "text";
  className?: string;
  /** Smallest allowed for type="number". */
  min?: number;
  /** Step for type="number". */
  step?: number;
  disabled?: boolean;
}

/**
 * Double-click (or Enter) to edit, Esc to cancel, Enter to commit.
 * Optimistic update: the cell shows the new value while saving; reverts on error.
 */
export function InlineEditCell<TValue extends string | number>({
  value,
  onSave,
  display,
  type = "text",
  inputMode,
  className,
  min,
  step,
  disabled,
}: InlineEditCellProps<TValue>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = async () => {
    if (saving) return;
    const next = type === "number" ? (Number(draft) as TValue) : (draft as TValue);
    if (type === "number" && Number.isNaN(next as number)) {
      setDraft(String(value));
      setEditing(false);
      return;
    }
    if (next === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } catch {
      // Rollback handled by the caller updating `value` after re-fetch fails.
      setDraft(String(value));
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(String(value));
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onDoubleClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            setEditing(true);
          }
        }}
        className={cn(
          "w-full text-left rounded px-1 py-0.5 outline-none",
          !disabled && "hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-primary",
          disabled && "opacity-60 cursor-not-allowed",
          className
        )}
        title={disabled ? undefined : "Düzenlemek için çift tıklayın veya Enter'a basın"}
      >
        {display ? display(value) : String(value)}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        ref={inputRef}
        type={type}
        inputMode={inputMode}
        min={min}
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        onBlur={() => void commit()}
        disabled={saving}
        className={cn("h-7 px-1.5 text-sm", className)}
      />
      {saving ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      ) : (
        <>
          <button
            type="button"
            onClick={() => void commit()}
            className="text-emerald-500 hover:text-emerald-400"
            aria-label="Kaydet"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={cancel}
            className="text-muted-foreground hover:text-foreground"
            aria-label="İptal"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
