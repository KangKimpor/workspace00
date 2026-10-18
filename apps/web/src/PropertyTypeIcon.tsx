import { CalendarDays, CheckSquare, CircleDot, FileText, Hash, Link, List, Mail, Paperclip, Phone, Sigma, Tags, Type, UserRound, type LucideIcon } from "lucide-react";
import type { PropertyType } from "@veloradesk/core/model";

const icons: Record<PropertyType, LucideIcon> = {
  title: Type, text: FileText, number: Hash, select: List, "multi-select": Tags,
  status: CircleDot, date: CalendarDays, checkbox: CheckSquare, url: Link,
  email: Mail, phone: Phone, person: UserRound, files: Paperclip, relation: Link, rollup: Sigma,
};
export default function PropertyTypeIcon({ type, size = 16 }: { type: PropertyType; size?: number }) {
  const Icon = icons[type];
  return <Icon size={size} aria-hidden="true" />;
}
