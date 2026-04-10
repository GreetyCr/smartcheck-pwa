"use client";

import {
  Document,
  Image,
  Page,
  Text,
  View,
} from "@react-pdf/renderer";
import { SECTIONS_CONFIG } from "@/lib/constants/sectionItems";
import { countFindingsInDoc } from "@/lib/pdf/countFindings";
import { formatItemForPdf } from "@/lib/pdf/formatItem";
import { pdfStyles as styles } from "@/lib/pdf/reportStyles";
import type { PdfExportPayload } from "@/lib/pdf/types";
import {
  labelCountry,
  labelEngine,
  labelTransmission,
} from "@/lib/pdf/vehicleLabels";

const DISCLAIMER = `El presente informe describe el estado aparente del vehículo en el momento y lugar de la inspección, con base en una revisión visual y funcional limitada. No constituye garantía de condición futura, ausencia de defectos ocultos ni valor comercial. Smartcheck y el inspector no se hacen responsables por defectos no detectables en esta evaluación, ni por reparaciones o decisiones de compra basadas en este documento. El cliente declara haber leído y comprendido estas limitaciones.`;

function plateLine(inspection: Record<string, unknown>): string {
  const idType = inspection.identifierType as string | undefined;
  const id = (inspection.identifier as string | undefined)?.trim();
  const vin = (inspection.vin as string | undefined)?.trim();
  if (idType === "placa" && id) return `Placa: ${id.toUpperCase()}`;
  if (id) return `Identificador: ${id}`;
  if (vin) return `VIN: ${vin}`;
  return "Identificador: —";
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("es-CR", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

type Props = { data: PdfExportPayload };

export function InspectionReportDocument({ data }: Props) {
  const { inspection, sections, vehiclePhotoUrl, circulationCardUrl } = data;
  const ins = inspection;
  const orderNo = String(ins._id ?? "—").slice(-8).toUpperCase();
  const created = ins._creationTime as number | undefined;

  const gallery: { n: number; caption: string; url: string }[] = [];
  let g = 0;
  for (const sec of sections) {
    const cfg = SECTIONS_CONFIG.find((c) => c.table === sec.table);
    const name = cfg?.name ?? sec.table;
    for (const item of cfg?.items ?? []) {
      const urls = sec.itemPhotoUrls[item.key] ?? [];
      for (const url of urls) {
        g += 1;
        gallery.push({
          n: g,
          caption: `${name} — ${item.label}`,
          url,
        });
      }
    }
    let si = 0;
    for (const url of sec.sectionPhotoUrls) {
      si += 1;
      g += 1;
      gallery.push({
        n: g,
        caption: `${name} — Foto sección ${si}`,
        url,
      });
    }
  }
  if (vehiclePhotoUrl) {
    g += 1;
    gallery.push({ n: g, caption: "Vehículo", url: vehiclePhotoUrl });
  }
  if (circulationCardUrl) {
    g += 1;
    gallery.push({ n: g, caption: "Tarjeta de circulación", url: circulationCardUrl });
  }

  const galleryChunks: (typeof gallery)[] = [];
  for (let i = 0; i < gallery.length; i += 4) {
    galleryChunks.push(gallery.slice(i, i + 4));
  }

  const finalDoc = sections.find((s) => s.table === "section_finalizacion")?.doc;
  const inspectorName =
    (finalDoc?.nombre_inspector as string | undefined)?.trim() || "—";
  const fechaHora = finalDoc?.fecha_hora as number | undefined;
  const comentarioRaw = finalDoc?.comentario_final as
    | { texto?: string }
    | string
    | undefined;
  const comentarioFinal =
    typeof comentarioRaw === "object" && comentarioRaw && "texto" in comentarioRaw
      ? String((comentarioRaw as { texto?: string }).texto ?? "").trim()
      : typeof comentarioRaw === "string"
        ? comentarioRaw.trim()
        : "";

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.coverHeader}>
          <Text style={styles.coverTitle}>SMARTCHECK</Text>
          <Text style={styles.coverSubtitle}>
            INFORME DE INSPECCIÓN VEHICULAR
          </Text>
        </View>
        <Text style={{ fontSize: 8, color: "#666", marginBottom: 16 }}>
          N.º de orden: {orderNo}
        </Text>
        <View style={styles.coverRow}>
          <Text style={styles.coverLabel}>{plateLine(ins)}</Text>
          <Text style={styles.coverValue}>
            {[ins.vehicleBrand, ins.vehicleModel, ins.vehicleYear]
              .filter(Boolean)
              .join(" ") || "—"}
          </Text>
        </View>
        <View style={styles.coverRow}>
          <Text style={styles.coverLabel}>Kilometraje</Text>
          <Text style={styles.coverValue}>
            {ins.mileage != null
              ? `${ins.mileage} ${(ins.mileageUnit as string) === "millas" ? "mi" : "km"}`
              : "—"}
          </Text>
        </View>
        <View style={styles.coverRow}>
          <Text style={styles.coverLabel}>País de origen</Text>
          <Text style={styles.coverValue}>
            {labelCountry(ins.countryOfOrigin as string | undefined)}
          </Text>
        </View>
        <View style={styles.coverRow}>
          <Text style={styles.coverLabel}>Tipo de motor</Text>
          <Text style={styles.coverValue}>
            {labelEngine(ins.engineType as string | undefined)}
            {ins.engineSpec
              ? ` — ${String(ins.engineSpec)}`
              : ""}
          </Text>
        </View>
        <View style={styles.coverRow}>
          <Text style={styles.coverLabel}>Transmisión</Text>
          <Text style={styles.coverValue}>
            {labelTransmission(ins.transmissionType as string | undefined)}
          </Text>
        </View>
        <View style={styles.coverRow}>
          <Text style={styles.coverLabel}>Fecha de inspección</Text>
          <Text style={styles.coverValue}>
            {created ? formatDate(created) : "—"}
          </Text>
        </View>
        {(vehiclePhotoUrl || circulationCardUrl) ? (
          <View style={{ flexDirection: "row", marginTop: 16 }}>
            {vehiclePhotoUrl ? (
              <View style={styles.photoThumbWrap}>
                <Image src={vehiclePhotoUrl} style={styles.photoThumb} />
              </View>
            ) : null}
            {circulationCardUrl ? (
              <View style={styles.photoThumbWrap}>
                <Image src={circulationCardUrl} style={styles.photoThumb} />
              </View>
            ) : null}
          </View>
        ) : null}
      </Page>

      {sections
        .filter((sec) => sec.table !== "section_finalizacion")
        .map((sec) => {
          const cfg = SECTIONS_CONFIG.find((c) => c.table === sec.table);
          if (!cfg) return null;
          const findings = countFindingsInDoc(sec.doc);
          const name = cfg.name;
          return (
            <Page key={sec.table} size="LETTER" style={styles.page}>
              <Text style={styles.pageHeader}>Smartcheck · {orderNo}</Text>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{name.toUpperCase()}</Text>
                <Text style={styles.sectionMeta}>{findings} señalados</Text>
              </View>
              {cfg.items.map((item) => {
                const raw = sec.doc?.[item.key];
                const line = formatItemForPdf(item, raw);
                const valueStyle =
                  line.value.includes("reparación") || line.value === "No"
                    ? styles.repair
                    : line.value === "—"
                      ? styles.muted
                      : styles.good;
                return (
                  <View key={item.key}>
                    <View style={styles.itemRow}>
                      <Text style={styles.itemLabel}>{line.label}</Text>
                      <Text style={[styles.itemValue, valueStyle]}>
                        {line.value}
                      </Text>
                    </View>
                    {line.observation ? (
                      <Text style={styles.observation}>
                        → Observación: {line.observation}
                      </Text>
                    ) : null}
                    {(sec.itemPhotoUrls[item.key] ?? []).length > 0 ? (
                      <View style={styles.photoRow}>
                        {(sec.itemPhotoUrls[item.key] ?? []).map((url, i) => (
                          <View key={`${item.key}-${i}`} style={styles.photoThumbWrap}>
                            <Image src={url} style={styles.photoThumb} />
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
              {sec.sectionPhotoUrls.length > 0 ? (
                <View style={styles.photoRow}>
                  {sec.sectionPhotoUrls.map((url, i) => (
                    <View key={`sec-${i}`} style={styles.photoThumbWrap}>
                      <Image src={url} style={styles.photoThumb} />
                    </View>
                  ))}
                </View>
              ) : null}
            </Page>
          );
        })}

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.pageHeader}>Smartcheck · {orderNo}</Text>
        <Text style={styles.footerTitle}>Finalización</Text>
        <View style={styles.coverRow}>
          <Text style={styles.coverLabel}>Inspector</Text>
          <Text style={styles.coverValue}>{inspectorName}</Text>
        </View>
        <View style={styles.coverRow}>
          <Text style={styles.coverLabel}>Fecha y hora (cierre)</Text>
          <Text style={styles.coverValue}>
            {fechaHora ? formatDate(fechaHora) : created ? formatDate(created) : "—"}
          </Text>
        </View>
        {comentarioFinal ? (
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 9, fontWeight: "bold", marginBottom: 4 }}>
              Comentario final
            </Text>
            <Text style={{ fontSize: 9, lineHeight: 1.35 }}>{comentarioFinal}</Text>
          </View>
        ) : null}
        <Text style={{ marginTop: 16, marginBottom: 8, fontSize: 10, fontWeight: "bold" }}>
          Descargo de responsabilidad
        </Text>
        <Text style={styles.disclaimer}>{DISCLAIMER}</Text>
      </Page>

      {galleryChunks.map((chunk, pi) => (
        <Page key={`gal-${pi}`} size="LETTER" style={styles.page}>
          <Text style={styles.pageHeader}>
            Galería de fotos (pág. {pi + 1} de {galleryChunks.length || 1})
          </Text>
          <View style={styles.galleryGrid}>
            {chunk.map((g) => (
              <View key={g.n} style={styles.galleryCell}>
                <Image src={g.url} style={styles.galleryImg} />
                <Text style={styles.galleryCap}>
                  Foto {g.n}: {g.caption}
                </Text>
              </View>
            ))}
          </View>
        </Page>
      ))}
    </Document>
  );
}
