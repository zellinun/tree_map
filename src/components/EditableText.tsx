import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onSave: (next: string) => void | Promise<void>;
  // Render-mode classes for the static text and the input. Use this to
  // match the surrounding typography (e.g. h1 vs td font sizes).
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  // Allow empty values? Default false: empty input reverts to current value.
  allowEmpty?: boolean;
  // For longer text — optional textarea variant.
  multiline?: boolean;
  // Suppress the hover edit affordance (useful in print where it would
  // print as a stray icon if the browser ignored print:hidden, or in
  // numeric cells where the pencil clutters the table).
  hideAffordance?: boolean;
  // Underlying input type / inputMode hint. Use type="number" with
  // inputMode="numeric" for whole-number cells so iOS shows the keypad.
  type?: "text" | "number";
  inputMode?: "text" | "numeric" | "decimal";
};

// Inline-editable text. Click the value to enter edit mode, type, then
// Enter or blur to save. Esc cancels. The component is fully controlled
// from the outside via `value` so server updates flow back in cleanly.
export default function EditableText({
  value,
  onSave,
  className,
  inputClassName,
  placeholder,
  allowEmpty = false,
  multiline = false,
  hideAffordance = false,
  type = "text",
  inputMode,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = async () => {
    if (busy) return;
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed === value) return;
    if (!allowEmpty && !trimmed) {
      setDraft(value);
      return;
    }
    setBusy(true);
    try {
      await onSave(trimmed);
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    if (multiline) {
      return (
        <textarea
          ref={(el) => {
            inputRef.current = el;
          }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
            // Enter alone commits; Shift+Enter inserts a newline.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commit();
            }
          }}
          placeholder={placeholder}
          rows={2}
          className={cn(
            "w-full rounded border border-ink/15 bg-paper px-2 py-1 outline-none focus-visible:border-accent",
            inputClassName ?? className
          )}
        />
      );
    }
    return (
      <input
        ref={(el) => {
          inputRef.current = el;
        }}
        type={type}
        inputMode={inputMode}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        placeholder={placeholder}
        className={cn(
          "w-full min-w-0 rounded border border-ink/15 bg-paper px-1.5 py-0.5 outline-none focus-visible:border-accent",
          inputClassName ?? className
        )}
      />
    );
  }

  const display = value || placeholder || "";
  return (
    <span
      onClick={() => setEditing(true)}
      title="Click to edit"
      className={cn(
        "group cursor-text rounded outline-none",
        "hover:bg-ink/5 focus-visible:bg-ink/5",
        // The print stylesheet hides .no-print descendants, so the pencil
        // hint vanishes on paper while the text stays.
        className
      )}
      tabIndex={0}
      onFocus={() => setEditing(true)}
    >
      {display}
      {hideAffordance ? null : (
        <Pencil className="no-print ml-1 inline-block h-3 w-3 align-baseline opacity-0 transition group-hover:opacity-50" />
      )}
    </span>
  );
}
