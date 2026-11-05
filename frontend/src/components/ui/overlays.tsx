"use client";

import { X } from "lucide-react";
import { Dialog as D, DropdownMenu as DM, Tabs as T, Tooltip as TT } from "radix-ui";
import { useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

// ─── Dialog (centred modal) ───────────────────────────────────────────────────

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

const overlay =
  "fixed inset-0 z-50 bg-[rgb(20_21_24/0.55)] data-[state=open]:animate-[overlay-in_200ms_ease-out] data-[state=closed]:animate-[overlay-out_150ms_ease-in]";

export function DialogContent({
  title,
  description,
  children,
  className,
  footer,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  footer?: ReactNode;
}) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto rounded-xl bg-surface p-6 shadow-lg",
          "data-[state=open]:animate-[dialog-in_220ms_var(--ease-out)] data-[state=closed]:animate-[dialog-out_140ms_ease-in]",
          className,
        )}
      >
        <div className="pr-8">
          <D.Title className="font-display text-xl font-semibold">{title}</D.Title>
          {description ? (
            <D.Description className="mt-1.5 text-[15px] text-muted-foreground">{description}</D.Description>
          ) : (
            <D.Description className="sr-only">{title}</D.Description>
          )}
        </div>
        {children}
        {footer ? (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>
        ) : null}
        <D.Close asChild>
          <Button variant="ghost" size="icon-sm" className="absolute top-4 right-4" aria-label="Close">
            <X />
          </Button>
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}

// ─── Sheet (side panel; bottom on phones) ─────────────────────────────────────

export function SheetContent({
  title,
  description,
  children,
  className,
  footer,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  footer?: ReactNode;
}) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content
        className={cn(
          "fixed z-50 flex flex-col bg-surface shadow-lg",
          "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl data-[state=open]:animate-[sheet-up_320ms_var(--ease-drawer)] data-[state=closed]:animate-[sheet-down_200ms_ease-in]",
          "sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[min(560px,100vw)] sm:rounded-none sm:rounded-l-2xl sm:data-[state=open]:animate-[sheet-left_320ms_var(--ease-drawer)] sm:data-[state=closed]:animate-[sheet-right_200ms_ease-in]",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="min-w-0">
            <D.Title className="font-display text-xl font-semibold">{title}</D.Title>
            {description ? (
              <D.Description className="mt-1 text-sm text-muted-foreground">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{title}</D.Description>
            )}
          </div>
          <D.Close asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Close">
              <X />
            </Button>
          </D.Close>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <div className="flex gap-2 border-t border-border px-6 py-4 [&>*]:flex-1 sm:[&>*]:flex-none sm:justify-end">
            {footer}
          </div>
        ) : null}
      </D.Content>
    </D.Portal>
  );
}

// ─── Confirm dialog (only for destructive or irreversible actions) ───────────

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "danger",
  onConfirm,
  children,
}: {
  trigger: ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  onConfirm: () => Promise<unknown> | void;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        title={title}
        description={description}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant={tone}
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  setOpen(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

// ─── Dropdown menu ────────────────────────────────────────────────────────────

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;

export function DropdownMenuContent({
  className,
  align = "end",
  ...props
}: ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={8}
        className={cn(
          "z-50 min-w-52 origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-lg border border-border bg-surface p-1.5 shadow-lg",
          "data-[state=open]:animate-[pop-in_160ms_var(--ease-out)]",
          className,
        )}
        {...props}
      />
    </DM.Portal>
  );
}

export function DropdownMenuItem({
  className,
  danger,
  ...props
}: ComponentProps<typeof DM.Item> & { danger?: boolean }) {
  return (
    <DM.Item
      className={cn(
        "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-3 text-[15px] outline-none select-none data-[highlighted]:bg-surface-muted [&_svg]:size-4 [&_svg]:text-muted-foreground",
        danger && "text-danger [&_svg]:text-danger",
        className,
      )}
      {...props}
    />
  );
}

export const DropdownMenuLabel = ({ className, ...props }: ComponentProps<typeof DM.Label>) => (
  <DM.Label
    className={cn(
      "px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase",
      className,
    )}
    {...props}
  />
);
export const DropdownMenuSeparator = () => <DM.Separator className="my-1.5 h-px bg-border" />;

// ─── Tabs (underline style) ───────────────────────────────────────────────────

export const Tabs = T.Root;
export const TabsContent = ({ className, ...props }: ComponentProps<typeof T.Content>) => (
  <T.Content className={cn("mt-6 outline-none", className)} {...props} />
);

export function TabsList({ className, ...props }: ComponentProps<typeof T.List>) {
  return (
    <T.List
      className={cn("flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "relative -mb-px flex h-11 shrink-0 cursor-pointer items-center gap-2 border-b-2 border-transparent px-3 text-[15px] font-semibold text-muted-foreground transition-colors",
        "hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <TT.Provider delayDuration={300} skipDelayDuration={400}>
      <TT.Root>
        <TT.Trigger asChild>{children}</TT.Trigger>
        <TT.Portal>
          <TT.Content
            sideOffset={6}
            className="z-50 rounded-md bg-secondary px-2.5 py-1.5 text-[13px] font-medium text-secondary-foreground shadow-md data-[state=delayed-open]:animate-[pop-in_125ms_var(--ease-out)]"
          >
            {content}
          </TT.Content>
        </TT.Portal>
      </TT.Root>
    </TT.Provider>
  );
}
