"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ApiError, errorMessage } from "@/lib/api";
import { useSession } from "@/components/session";
import type { Permission, Role } from "@wholesale/shared";
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="page-title">{title}</h1>
        {description && (
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
export function Panel({
  children,
  className,
  title,
  description,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn("panel", className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            {description && (
              <p className="mt-1 text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Pill({
  children,
  tone = "neutral",
  dot = false,
}: {
  children: React.ReactNode;
  tone?: "success" | "warning" | "danger" | "primary" | "neutral";
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium",
        {
          success: "bg-emerald-50 text-emerald-700",
          warning: "bg-amber-50 text-amber-700",
          danger: "bg-rose-50 text-rose-700",
          primary: "bg-violet-50 text-violet-700",
          neutral: "bg-slate-100 text-slate-600",
        }[tone],
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
export function Status({ value }: { value: string }) {
  const tones: Record<
    string,
    "success" | "warning" | "danger" | "primary" | "neutral"
  > = {
    PAID: "success",
    VERIFIED: "success",
    APPROVED: "success",
    ACTIVE: "success",
    WON: "success",
    RESOLVED: "success",
    PARTIAL: "warning",
    UNPAID: "warning",
    PENDING: "warning",
    NEW: "primary",
    OPEN: "primary",
    REJECTED: "danger",
    SUSPENDED: "danger",
    CANCELLED: "danger",
    DISABLED: "neutral",
    IN_PROGRESS: "warning",
    QUOTED: "warning",
  };
  return (
    <Pill tone={tones[value] || "neutral"} dot>
      {value
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/^./, (c) => c.toUpperCase())}
    </Pill>
  );
}
export function Metric({
  label,
  value,
  icon,
  detail,
  change,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  detail?: string;
  change?: number;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span className="flex size-8 items-center justify-center rounded-lg bg-[#f5f4fc] text-[#837bd6] [&_svg]:size-4">
          {icon}
        </span>
      </div>
      <div className="numeric mt-3 text-[27px] font-semibold tracking-tight">
        {value}
      </div>
      <div className="mt-2 flex min-h-4 items-center gap-1.5 text-[11px] text-muted-foreground">
        {change !== undefined && (
          <span
            className={cn(
              "inline-flex items-center",
              change >= 0 ? "text-emerald-600" : "text-rose-500",
            )}
          >
            {change >= 0 ? (
              <ArrowUp className="mr-0.5 size-3" />
            ) : (
              <ArrowDown className="mr-0.5 size-3" />
            )}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
        {detail}
      </div>
    </div>
  );
}
export function Thumb({
  src,
  name,
  size = 40,
}: {
  src?: string;
  name: string;
  size?: number;
}) {
  return (
    <div
      style={{ width: size, height: size }}
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/3 bg-[#f3f0eb]"
    >
      {src ? (
        <Image
          src={src}
          alt={name}
          fill
          sizes={`${size}px`}
          className="object-cover"
          unoptimized
        />
      ) : (
        <Package className="size-4 text-stone-400" />
      )}
    </div>
  );
}
export function Initials({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-xs font-medium text-violet-600",
        className,
      )}
    >
      {name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()}
    </span>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center p-8 text-center">
      <div className="mb-3 rounded-xl bg-muted p-3">
        <Package className="size-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function Loading() {
  return (
    <div aria-label="Loading workspace" className="space-y-5">
      <Skeleton className="h-9 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  const auth = error instanceof ApiError && [401, 403].includes(error.status);
  return (
    <Panel>
      <Empty
        title={auth ? "Access unavailable" : "Could not load this workspace"}
        description={errorMessage(error)}
        action={
          retry ? (
            <Button variant="outline" onClick={retry}>
              <RefreshCw />
              Try again
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          )
        }
      />
    </Panel>
  );
}
export function Gate({
  permission,
  roles,
  children,
}: {
  permission?: Permission;
  roles?: Role[];
  children: React.ReactNode;
}) {
  const { user, can, loading } = useSession();
  if (loading) return <Loading />;
  if (!user) return null;
  if ((permission && !can(permission)) || (roles && !roles.includes(user.role)))
    return (
      <Panel>
        <div className="p-10 text-center">
          <ShieldAlert className="mx-auto mb-3 size-7 text-muted-foreground" />
          <h1 className="text-lg font-semibold">
            This workspace needs permission
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Contact your business owner or platform administrator for access.
          </p>
        </div>
      </Panel>
    );
  return children;
}
export function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="form-label">
        {label}
        {required && <span className="ml-0.5 text-primary">*</span>}
      </span>
      {children}
      {hint && (
        <span className="block text-[11px] leading-4 text-muted-foreground">
          {hint}
        </span>
      )}
    </label>
  );
}
export function FormError({ message }: { message?: string }) {
  return message ? (
    <div
      role="alert"
      className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs leading-5 text-rose-700"
    >
      {message}
    </div>
  ) : null;
}
export function BusyButton({
  busy,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { busy?: boolean }) {
  return (
    <Button {...props} disabled={busy || props.disabled}>
      {busy && <Loader2 className="size-4 animate-spin" />}
      {children}
    </Button>
  );
}
export type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  className?: string;
};
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  pageSize = 10,
  pagination,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  pageSize?: number;
  pagination?: { page: number; total: number; onPage: (page: number) => void };
}) {
  const [page, setPage] = useState(1);
  const total = pagination?.total ?? rows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(pagination?.page ?? page, pages);
  const shown = pagination
    ? rows
    : rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  return (
    <>
      {shown.length ? (
        <Table>
          <TableHeader>
            <TableRow className="bg-[#fafbfc] hover:bg-[#fafbfc]">
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn("table-header h-10 px-5", c.className)}
                >
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((row) => (
              <TableRow key={rowKey(row)} className="hover:bg-[#fafaff]">
                {columns.map((c) => (
                  <TableCell
                    key={c.key}
                    className={cn("px-5 py-3.5 text-[12px]", c.className)}
                  >
                    {c.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Empty title={emptyTitle} description={emptyDescription} />
      )}
      <Pagination
        total={total}
        page={safePage}
        pageSize={pageSize}
        onPage={pagination?.onPage ?? setPage}
      />
    </>
  );
}
export function Pagination({
  total,
  page,
  pageSize,
  onPage,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3 text-[11px] text-muted-foreground">
      <span>
        {total
          ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`
          : "0 records"}
      </span>
      <div className="flex items-center gap-2">
        <span>
          Page {page} of {pages}
        </span>
        <Button
          variant="outline"
          size="icon-xs"
          disabled={page <= 1}
          aria-label="Previous page"
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon-xs"
          disabled={page >= pages}
          aria-label="Next page"
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirm,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirm: string;
  busy?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep it
          </Button>
          <BusyButton busy={busy} variant="destructive" onClick={onConfirm}>
            {confirm}
          </BusyButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
