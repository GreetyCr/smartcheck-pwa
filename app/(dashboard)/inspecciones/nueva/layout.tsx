import { InspectionWizardProvider } from "@/components/inspection/InspectionWizard";

export default function NuevaInspeccionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <InspectionWizardProvider>{children}</InspectionWizardProvider>;
}
