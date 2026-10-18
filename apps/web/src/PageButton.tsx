import type { CSSProperties } from 'react';
import type { Page } from '@veloradesk/core/model';
import { Pressable } from '@veloradesk/ui';
import { Star, ChevronRight } from './Coolicons';
import { pageIcon,titleOf,displayDate } from './page-presentation';
export default function PageButton({
  page,
  onOpen,
  small = false,
  style,
}: {
  page: Page;
  onOpen: (id: string) => void;
  small?: boolean;
  style?: CSSProperties;
}) {
  return (
    <Pressable
      className={`ws-page-row ${small ? "compact" : ""} ${page.type === "journal" && !small ? "ws-journal-entry" : ""}`}
      style={style}
      onClick={() => onOpen(page.id)}
    >
      {page.type === "journal" && !small ? (
        <span className="ws-journal-date-badge" aria-hidden="true">
          <span>{new Date(`${page.date ?? page.createdAt.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: "short" })}</span>
          <strong>{Number((page.date ?? page.createdAt.slice(0, 10)).slice(-2))}</strong>
        </span>
      ) : <span className="ws-page-icon" aria-hidden="true">{pageIcon(page)}</span>}
      <span className="ws-page-row-text">
        <strong>{titleOf(page)}</strong>
        {page.type === "journal" && !small && <small className="ws-journal-preview">{page.properties.__locked ? "Protected entry" : String(page.properties.__text ?? "").trim().slice(0, 140) || "A moment from your day"}</small>}
        <span>
          {page.type === "journal" && page.date
            ? displayDate(page.date)
            : `${page.type === "row" ? "Database row" : page.type.charAt(0).toUpperCase() + page.type.slice(1)} · ${new Date(page.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
        </span>
      </span>
      {page.favorite && <Star size={14} className="ws-accent" />}
      <ChevronRight size={16} className="ws-muted" />
    </Pressable>
  );
}

