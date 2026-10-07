import {
  createContext,
  forwardRef,
  useContext,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

interface FieldWrapperProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

// What a FieldWrapper tells the field inside it, so a screen reader can tell
// which field is wrong and read its message with it — pages don't pass
// anything extra. Only the field whose id is the wrapper's htmlFor takes it,
// so a field nested deeper (e.g. an address block) isn't described by the
// wrong message.
interface FieldState {
  id: string;
  messageId?: string;
  invalid: boolean;
}

const FieldContext = createContext<FieldState | null>(null);

export function FieldWrapper({ label, htmlFor, error, hint, required, children }: FieldWrapperProps) {
  const messageId = error || hint ? `${htmlFor}-message` : undefined;
  return (
    <FieldContext.Provider value={{ id: htmlFor, messageId, invalid: !!error }}>
      <div className="space-y-1.5">
        <label htmlFor={htmlFor} className="block text-sm font-medium text-primary">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
        {children}
        {/* Always present, so an error that appears as the user types is
            announced. A hint isn't: it's read with the field instead (and the
            approve form's hints change on every keystroke). */}
        <div aria-live="polite">
          {error && (
            <p id={messageId} className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
        {!error && hint && (
          <p id={messageId} className="text-sm text-slate-500">
            {hint}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}

// aria-invalid and aria-describedby for a field, from its FieldWrapper (if
// it's the wrapper's own field) and its own hasError, keeping any
// aria-describedby the page set.
function useFieldA11y(id: string | undefined, hasError: boolean | undefined, describedBy: string | undefined) {
  const field = useContext(FieldContext);
  const own = field && id !== undefined && field.id === id ? field : null;
  const invalid = hasError || own?.invalid;
  const ids = [describedBy, own?.messageId].filter(Boolean).join(" ");
  return {
    "aria-invalid": invalid ? true : undefined,
    "aria-describedby": ids || undefined,
  } as const;
}

const fieldBase =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm text-primary placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors";

function fieldStateClasses(hasError?: boolean) {
  return hasError
    ? "border-red-300 focus:border-red-500 focus:ring-red-500/30"
    : "border-slate-300 focus:border-tertiary focus:ring-tertiary/30";
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }>(
  ({ className, hasError, ...props }, ref) => {
    const a11y = useFieldA11y(props.id, hasError, props["aria-describedby"]);
    return <input ref={ref} className={cn(fieldBase, fieldStateClasses(hasError), className)} {...props} {...a11y} />;
  },
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { hasError?: boolean }
>(({ className, hasError, ...props }, ref) => {
  const a11y = useFieldA11y(props.id, hasError, props["aria-describedby"]);
  return <textarea ref={ref} className={cn(fieldBase, fieldStateClasses(hasError), className)} {...props} {...a11y} />;
});
Textarea.displayName = "Textarea";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { hasError?: boolean }
>(({ className, hasError, children, ...props }, ref) => {
  const a11y = useFieldA11y(props.id, hasError, props["aria-describedby"]);
  return (
    <select ref={ref} className={cn(fieldBase, fieldStateClasses(hasError), className)} {...props} {...a11y}>
      {children}
    </select>
  );
});
Select.displayName = "Select";
