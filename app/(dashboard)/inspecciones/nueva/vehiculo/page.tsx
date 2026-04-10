import { WizardStepHeader } from "@/components/inspection/WizardStepHeader";
import { ProgressBar } from "@/components/inspection/ProgressBar";
import { VehicleForm } from "@/components/inspection/VehicleForm";

export default function NuevaInspeccionVehiculoPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#F8F9FA]">
      <WizardStepHeader title="Nueva Inspección" backHref="/inspecciones/nueva/cliente" />
      <div className="border-b border-border bg-card px-4 py-3">
        <ProgressBar
          step={2}
          totalSteps={4}
          sectionTitle="Datos del Vehículo"
        />
      </div>
      <VehicleForm className="flex-1 pb-8" />
    </div>
  );
}
