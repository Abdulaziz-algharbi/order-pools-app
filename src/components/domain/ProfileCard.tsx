import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { UserIcon } from "@/components/ui/icons";

interface ProfileField {
  label: string;
  value: ReactNode;
}

interface ProfileCardProps {
  name: string;
  subtitle: string;
  email: string;
  fields: ProfileField[];
  badge?: ReactNode;
}

export function ProfileCard({ name, subtitle, email, fields, badge }: ProfileCardProps) {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-tertiary/10 text-tertiary">
            <UserIcon className="h-8 w-8" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate font-heading text-lg font-semibold text-primary">{name}</h2>
              {badge}
            </div>
            <p className="truncate text-sm text-slate-500">{subtitle}</p>
            <p className="truncate text-sm text-slate-400">{email}</p>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.label}>
              <dt className="text-xs text-slate-400">{f.label}</dt>
              <dd className="mt-0.5 text-sm font-medium text-primary">{f.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
