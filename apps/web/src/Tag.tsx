import type { ReactNode } from "react";
import { optionColor } from "./tag-colors";

export default function Tag({ value, children }: { value: string; children?: ReactNode }) {
  return <span className="ws-tag" data-color={optionColor(value)}>{children ?? value}</span>;
}
