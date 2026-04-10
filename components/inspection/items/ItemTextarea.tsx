"use client";

import type { SectionItem } from "@/lib/constants/sectionItems";

type ItemTextareaProps = {
  index: number;
  item: SectionItem;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
};

export function ItemTextarea({
  index,
  item,
  value,
  onChange,
  disabled,
}: ItemTextareaProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {index}
        </span>
        {item.label}
      </h3>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={item.placeholder}
        disabled={disabled}
        rows={5}
        className="w-full resize-y rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm outline-none ring-primary/30 placeholder:text-muted-foreground focus:border-primary focus:ring-2 min-h-[120px]"
      />
    </section>
  );
}
