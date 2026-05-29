"use client";

import { SectionItem, type SectionRowStatus } from "@/components/inspection/SectionItem";
import type { SectionDefinition } from "@/lib/constants/sections";
import { inspectionSectionHref } from "@/lib/inspection/sectionPaths";

type Summary = {
  table: string;
  status: SectionRowStatus;
  findings: number;
};

type SectionsListProps = {
  pathSegment: string;
  summaries: Summary[];
  /** Orden y filtrado (p. ej. sin tracción en 2WD). */
  sections: SectionDefinition[];
};

export function SectionsList({
  pathSegment,
  summaries,
  sections,
}: SectionsListProps) {
  const byTable = new Map(summaries.map((s) => [s.table, s]));

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Secciones de inspección
      </h2>
      <ul className="space-y-2">
        {sections.map((sec) => {
          const row = byTable.get(sec.table);
          const status: SectionRowStatus = row?.status ?? "pendiente";
          const findings = row?.findings ?? 0;
          return (
            <li key={sec.id}>
              <SectionItem
                href={inspectionSectionHref(pathSegment, sec.id)}
                name={sec.name}
                subtitle={sec.subtitle}
                icon={sec.icon}
                status={status}
                findingsCount={findings}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
