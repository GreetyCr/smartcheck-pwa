import { WizardStepHeader } from "@/components/inspection/WizardStepHeader";
import { ProgressBar } from "@/components/inspection/ProgressBar";
import { ClientForm } from "@/components/inspection/ClientForm";

export default function NuevaInspeccionClientePage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#F8F9FA]">
      <WizardStepHeader title="Nueva Inspección" backHref="/" />
      <div className="border-b border-border bg-card px-4 py-3">
        <ProgressBar step={1} totalSteps={4} />
      </div>
      <ClientForm className="flex-1 pb-8" />
    </div>
  );
}
