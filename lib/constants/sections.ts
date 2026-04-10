import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Armchair,
  Car,
  CheckSquare,
  Circle,
  Cog,
  Cpu,
  Disc,
  Fuel,
  Gauge,
  GitBranch,
  Lightbulb,
  Navigation,
  Route,
  Shield,
  Snowflake,
  Wind,
  Zap,
} from "lucide-react";
import type { TableNames } from "@/convex/_generated/dataModel";
import {
  SECTIONS_CONFIG,
  getVisibleSections,
  type SectionConfig,
} from "@/lib/constants/sectionItems";

/** Slug en la URL → coincide con `SectionConfig.id`. */
export type SectionSlug = (typeof SECTIONS_CONFIG)[number]["id"];

const LUCIDE_BY_NAME: Record<string, LucideIcon> = {
  Cog,
  GitBranch,
  Zap,
  Disc,
  Activity,
  Navigation,
  Wind,
  Circle,
  Fuel,
  Cpu,
  Lightbulb,
  Armchair,
  Snowflake,
  Shield,
  Car,
  Route,
  Gauge,
  CheckSquare,
};

export type SectionDefinition = {
  id: SectionSlug;
  name: string;
  subtitle?: string;
  icon: LucideIcon;
  table: TableNames;
};

function toDefinition(config: SectionConfig): SectionDefinition {
  return {
    id: config.id as SectionSlug,
    name: config.name,
    subtitle: config.subtitle,
    icon: LUCIDE_BY_NAME[config.icon] ?? Cog,
    table: config.table,
  };
}

/** Orden completo del catálogo (incluye tracción; filtra en UI con `getInspectionSections`). */
export const INSPECTION_SECTIONS: SectionDefinition[] =
  SECTIONS_CONFIG.map(toDefinition);

export const SECTION_TOTAL = INSPECTION_SECTIONS.length;

/** Secciones visibles para el vehículo (oculta tracción si no es 4WD). */
export function getInspectionSections(
  transmissionType?: string | null,
): SectionDefinition[] {
  return getVisibleSections(transmissionType).map(toDefinition);
}

export function getSectionBySlug(slug: string): SectionDefinition | undefined {
  return INSPECTION_SECTIONS.find((s) => s.id === slug);
}
