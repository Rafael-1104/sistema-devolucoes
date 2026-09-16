export function KeyboardShortcut({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-7 items-center justify-center rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] font-bold leading-none text-muted-foreground shadow-sm">
      {children}
    </kbd>
  );
}