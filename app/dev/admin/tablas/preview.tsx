"use client";

import { useEffect, useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { InspectionTableRow } from "@/components/admin/InspectionTableRow";
import { TechnicianRow } from "@/components/admin/TechnicianRow";
import { BiCard } from "@/components/bi/BiCard";
import { DevAdminShell } from "../shell";

/**
 * Filas de MUESTRA. Se construyen con los campos que las filas realmente leen y
 * se afirma el tipo del documento: rellenar el `Doc` completo no aportaría nada
 * a una revisión visual y ataría la muestra a cada cambio del esquema.
 */
const inspection = (
  partial: Partial<Omit<Doc<"inspections">, "_id">> & { _id: string },
): Doc<"inspections"> => partial as unknown as Doc<"inspections">;

const user = (
  partial: Partial<Omit<Doc<"users">, "_id">> & { _id: string },
): Doc<"users"> => partial as unknown as Doc<"users">;

const D = (iso: string) => Date.parse(`${iso}T09:30:00-06:00`);

/** Una fila por estado: es lo que se está revisando (badges legibles). */
const INSPECTIONS: {
  inspection: Doc<"inspections">;
  technicianName: string;
  pdf: boolean;
}[] = [
  {
    inspection: inspection({
      _id: "i1",
      _creationTime: D("2026-07-29"),
      identifierType: "placa",
      identifier: "bmt432",
      vehicleBrand: "Toyota",
      vehicleModel: "Fortuner",
      vehicleYear: 2019,
      status: "draft",
      totalAmountCharged: undefined,
    }),
    technicianName: "Esteban Vargas",
    pdf: false,
  },
  {
    inspection: inspection({
      _id: "i2",
      _creationTime: D("2026-07-28"),
      identifierType: "placa",
      identifier: "crc7781",
      vehicleBrand: "Hyundai",
      vehicleModel: "Tucson",
      vehicleYear: 2021,
      status: "completed",
      totalAmountCharged: 50_000,
      inspectionFee: 50_000,
      inGam: "si",
      biCommission: "no",
    }),
    technicianName: "Técnico 2",
    pdf: false,
  },
  {
    inspection: inspection({
      _id: "i3",
      _creationTime: D("2026-07-27"),
      identifierType: "vin",
      identifier: "JTMBFREV40J071234",
      vehicleBrand: "Mazda",
      vehicleModel: "CX-5",
      vehicleYear: 2018,
      status: "pending_sync",
      totalAmountCharged: 68_000,
      inspectionFee: 50_000,
      inGam: "no",
      outOfGamFee: 18_000,
      biCommission: "no",
    }),
    technicianName: "Kevin Solano",
    pdf: false,
  },
  {
    inspection: inspection({
      _id: "i4",
      _creationTime: D("2026-07-24"),
      identifierType: "placa",
      identifier: "sjo0192",
      vehicleBrand: "Nissan",
      vehicleModel: "Frontier",
      vehicleYear: 2020,
      status: "synced",
      totalAmountCharged: 62_000,
      inspectionFee: 50_000,
      inGam: "si",
      biCommission: "si",
      commissionFeeAmount: 12_000,
    }),
    technicianName: "María Fernández",
    pdf: true,
  },
  {
    inspection: inspection({
      _id: "i5",
      _creationTime: D("2026-07-20"),
      identifierType: "placa",
      identifier: "hda5540",
      vehicleBrand: "Honda",
      vehicleModel: "CR-V",
      vehicleYear: 2017,
      status: "report_delivered",
      reportDeliveredAt: D("2026-07-21"),
      totalAmountCharged: 50_000,
      inspectionFee: 50_000,
      inGam: "si",
      biCommission: "no",
    }),
    technicianName: "Esteban Vargas",
    pdf: true,
  },
];

const USERS: {
  user: Doc<"users">;
  inspectionCount: number;
  lastActivityAt: number | null;
}[] = [
  {
    user: user({
      _id: "u1",
      clerkId: "c1",
      name: "Esteban Vargas",
      email: "esteban@example.com",
      role: "admin",
    }),
    inspectionCount: 214,
    lastActivityAt: D("2026-07-29"),
  },
  {
    user: user({
      _id: "u2",
      clerkId: "c2",
      name: "Kevin Solano",
      email: "kevin@example.com",
      role: "tecnico",
      approvalStatus: "approved",
    }),
    inspectionCount: 96,
    lastActivityAt: D("2026-07-28"),
  },
  {
    user: user({
      _id: "u3",
      clerkId: "c3",
      name: "",
      email: "pendiente@example.com",
      role: "tecnico",
      approvalStatus: "pending",
    }),
    inspectionCount: 0,
    lastActivityAt: null,
  },
];

const TH_CLASS =
  "bi-num px-3 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--bi-ink-3)]";

export function AdminTablesPreview() {
  // Las filas se pintan solo en el cliente: formatean fechas con "Hoy/Ayer" y
  // `toLocaleString("es-CR")`, y el servidor (UTC) produce otro texto → la
  // hidratación fallaba. En las páginas reales no pasa porque las filas llegan
  // después del montaje, con los datos de Convex.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <DevAdminShell activePath="/admin/inspecciones">
      <h1 className="bi-display mb-1 text-[28px] font-bold uppercase leading-none text-[var(--bi-ink)] sm:text-[34px]">
        Filas de tabla
      </h1>
      <p className="bi-num mb-6 text-[11px] uppercase tracking-[0.14em] text-[var(--bi-ink-3)]">
        Chequeo de legibilidad sobre el grafito · un caso por estado
      </p>

      <BiCard
        className="mb-4 overflow-hidden"
        title="InspectionTableRow"
        subtitle="/admin/inspecciones"
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--bi-ring)]">
                <th scope="col" className={TH_CLASS}>
                  Placa / ID
                </th>
                <th scope="col" className={`${TH_CLASS} hidden sm:table-cell`}>
                  Vehículo
                </th>
                <th scope="col" className={TH_CLASS}>
                  Técnico
                </th>
                <th scope="col" className={`${TH_CLASS} hidden md:table-cell`}>
                  Fecha
                </th>
                <th scope="col" className={TH_CLASS}>
                  Estado
                </th>
                <th scope="col" className={`${TH_CLASS} text-right`}>
                  Cobrado
                </th>
                <th scope="col" className={`${TH_CLASS} text-right`}>
                  PDF
                </th>
              </tr>
            </thead>
            <tbody>
              {!mounted ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-sm text-[var(--bi-ink-3)]">
                    Cargando…
                  </td>
                </tr>
              ) : null}
              {mounted && INSPECTIONS.map((row) => (
                <InspectionTableRow
                  key={String(row.inspection._id)}
                  inspection={row.inspection}
                  technicianName={row.technicianName}
                  pdfInfo={
                    row.pdf
                      ? {
                          url: "#",
                          generatedAt: D("2026-07-24"),
                          fileName: "informe.pdf",
                        }
                      : null
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      </BiCard>

      <BiCard
        className="overflow-hidden"
        title="TechnicianRow"
        subtitle="/admin/tecnicos"
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--bi-ring)]">
                <th scope="col" className={TH_CLASS}>
                  Usuario
                </th>
                <th scope="col" className={TH_CLASS}>
                  Rol
                </th>
                <th scope="col" className={TH_CLASS}>
                  Inspecciones
                </th>
                <th scope="col" className={`${TH_CLASS} hidden lg:table-cell`}>
                  Última actividad
                </th>
                <th scope="col" className={`${TH_CLASS} text-right`}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {!mounted ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-sm text-[var(--bi-ink-3)]">
                    Cargando…
                  </td>
                </tr>
              ) : null}
              {mounted && USERS.map((row) => (
                <TechnicianRow
                  key={String(row.user._id)}
                  user={row.user}
                  inspectionCount={row.inspectionCount}
                  lastActivityAt={row.lastActivityAt}
                />
              ))}
            </tbody>
          </table>
        </div>
      </BiCard>
    </DevAdminShell>
  );
}
