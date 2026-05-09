import type { Id } from "@/convex/_generated/dataModel";
import { InspectionCabeceraScreen } from "@/components/inspection/InspectionCabeceraScreen";

type Props = { params: Promise<{ id: string }> };

export default async function InspeccionCabeceraPage({ params }: Props) {
  const { id } = await params;
  return (
    <InspectionCabeceraScreen inspectionId={id as Id<"inspections">} />
  );
}
