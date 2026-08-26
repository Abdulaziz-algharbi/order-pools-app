import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface FieldWrapperProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

export function FieldWrapper({ label, htmlFor, error, hint, required, children }: FieldWrapperProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-primary">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-sm text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

const fieldBase =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm text-primary placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors";

function fieldStateClasses(hasError?: boolean) {
  return hasError
    ? "border-red-300 focus:border-red-500 focus:ring-red-500/30"
    : "border-slate-300 focus:border-tertiary focus:ring-tertiary/30";
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }>(
  ({ className, hasError, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, fieldStateClasses(hasError), className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { hasError?: boolean }
>(({ className, hasError, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, fieldStateClasses(hasError), className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { hasError?: boolean }
>(({ className, hasError, children, ...props }, ref) => (
  <select ref={ref} className={cn(fieldBase, fieldStateClasses(hasError), className)} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";
