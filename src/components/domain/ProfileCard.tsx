import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/Card";

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
  /** The profile photo (with its controls) shown beside the name. */
  avatar: ReactNode;
}

export function ProfileCard({ name, subtitle, email, fields, badge, avatar }: ProfileCardProps) {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardContent className="space-y-6">
        <div className="space-y-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate font-heading text-lg font-semibold text-primary">{name}</h2>
              {badge}
            </div>
            <p className="truncate text-sm text-slate-500">{subtitle}</p>
            <p className="truncate text-sm text-slate-400">{email}</p>
          </div>
          {avatar}
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
