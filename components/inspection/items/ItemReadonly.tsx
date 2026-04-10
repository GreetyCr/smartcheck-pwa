"use client";

import type { SectionItem } from "@/lib/constants/sectionItems";

type ItemReadonlyProps = {
  index: number;
  item: SectionItem;
  displayValue: string;
};

export function ItemReadonly({ index, item, displayValue }: ItemReadonlyProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-2 flex items-center gap-2 text-base font-bold text-foreground">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {index}
        </span>
        {item.label}
      </h3>
      <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground">
        {displayValue}
      </p>
    </section>
  );
}
