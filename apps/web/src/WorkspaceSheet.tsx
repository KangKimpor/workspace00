import { useRef, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Pressable } from '@veloradesk/ui';
import { X } from './Coolicons';
import { SheetHandle } from './WorkspaceChrome';

export default function Sheet({
  open,
  onOpenChange,
  title,
  children,
  wide = false,
  onAfterClose,
  alert = false,
  popoverPosition,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  onAfterClose?: () => void;
  alert?: boolean;
  popoverPosition?: { left: number; top: number };
}) {
  const opener = useRef<HTMLElement | null>(null),
    content = useRef<HTMLDivElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={document.getElementById("root")}>
        <Dialog.Overlay className="ws-overlay" />
        <Dialog.Content
          ref={content}
          className={`ws-sheet ${wide ? "wide" : ""}`}
          role={alert ? "alertdialog" : "dialog"}
          style={popoverPosition ? { position:'fixed', ...popoverPosition, transform:'none', maxHeight:'70dvh' } : undefined}
          onOpenAutoFocus={(event) => {
            opener.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
            event.preventDefault();
            (
              content.current?.querySelector<HTMLElement>(
                '[data-sheet-autofocus]',
              ) ?? content.current?.querySelector<HTMLElement>(
                'input:not([type="file"]),button:not(.ws-sheet-handle)',
              ) ?? content.current
            )?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener.current?.isConnected) opener.current.focus();
            onAfterClose?.();
          }}
        >
          <SheetHandle content={content} open={open} />
          <div className="ws-sheet-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <Pressable className="ws-icon" aria-label={`Close ${title}`}>
                <X size={20} />
              </Pressable>
            </Dialog.Close>
          </div>
          <Dialog.Description className="ws-sr-only">
            {title} options
          </Dialog.Description>
          <div className="ws-sheet-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
