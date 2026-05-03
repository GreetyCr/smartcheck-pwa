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
import { pdfItemValueIsPositive } from "@/lib/pdf/itemPdfStyle";
import { pdfStyles as styles } from "@/lib/pdf/reportStyles";
import type { PdfExportPayload } from "@/lib/pdf/types";
import {
  labelCountry,
  labelEngine,
  labelSellerType,
  labelTransmission,
} from "@/lib/pdf/vehicleLabels";

const DISCLAIMER = `El presente informe describe el estado aparente del vehículo en el momento y lugar de la inspección, con base en una revisión visual y funcional limitada. No constituye garantía de condición futura, ausencia de defectos ocultos ni valor comercial. Smartcheck y el inspector no se hacen responsables por defectos no detectables en esta evaluación, ni por reparaciones o decisiones de compra basadas en este documento. El cliente declara haber leído y comprendido estas limitaciones.`;

function plateLine(inspection: Record<string, unknown>): string {
  const idType = inspection.identifierType as string | undefined;
  const id = (inspection.identifier as string | undefined)?.trim();
  const vin = (inspection.vin as string | undefined)?.trim();
  const plateNum = (inspection.plateNumber as string | undefined)?.trim();
  const parts: string[] = [];
  if (idType === "vin" && id) parts.push(`VIN: ${id}`);
  else if (idType === "placa" && id) parts.push(`Placa: ${id.toUpperCase()}`);
  else if (vin) parts.push(`VIN: ${vin}`);
  else if (id) parts.push(`Identificador: ${id}`);
  if (plateNum && idType === "vin") {
    parts.push(`Placa: ${plateNum.toUpperCase()}`);
  }
  return parts.length ? parts.join(" · ") : "Identificador: —";
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("es-CR", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

type Props = { data: PdfExportPayload };

export function InspectionReportDocument({ data }: Props) {
  const {
    inspection,
    sections,
    vehiclePhotoUrl,
    circulationCardUrl,
    vehicleAnglePhotoUrls,
    extraVehiclePhotoUrls,
  } = data;
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
  const angleGallery: { caption: string; url: string | null }[] = [
    { caption: "Vehículo — frontal", url: vehicleAnglePhotoUrls.front },
    { caption: "Vehículo — lateral izquierdo", url: vehicleAnglePhotoUrls.sideLeft },
    { caption: "Vehículo — lateral derecho", url: vehicleAnglePhotoUrls.sideRight },
    { caption: "Vehículo — trasera", url: vehicleAnglePhotoUrls.rear },
  ];
  for (const row of angleGallery) {
    if (row.url) {
      g += 1;
      gallery.push({ n: g, caption: row.caption, url: row.url });
    }
  }
  if (vehiclePhotoUrl && !vehicleAnglePhotoUrls.front) {
    g += 1;
    gallery.push({ n: g, caption: "Vehículo", url: vehiclePhotoUrl });
  }
  const plateNote = (ins.platePhotoNote as string | undefined)?.trim();
  const extrasGallery: { caption: string; url: string | null }[] = [
    { caption: "Dekra", url: extraVehiclePhotoUrls.dekra },
    {
      caption: plateNote ? `Placa (foto) — ${plateNote}` : "Placa (foto)",
      url: extraVehiclePhotoUrls.plate,
    },
    { caption: "Marchamo", url: extraVehiclePhotoUrls.marchamo },
    { caption: "VIN (etiqueta)", url: extraVehiclePhotoUrls.vinSticker },
  ];
  for (const row of extrasGallery) {
    if (row.url) {
      g += 1;
      gallery.push({ n: g, caption: row.caption, url: row.url });
    }
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
          <Text style={styles.coverLabel}>Origen de compra</Text>
          <Text style={styles.coverValue}>
            {labelSellerType(ins.sellerType as string | undefined)}
          </Text>
        </View>
        {(ins.sellerNote as string | undefined)?.trim() ? (
          <View style={styles.coverRow}>
            <Text style={styles.coverLabel}>Nota (origen)</Text>
            <Text style={styles.coverValue}>
              {String(ins.sellerNote).trim()}
            </Text>
          </View>
        ) : null}
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
        {(() => {
          const coverUrls = [
            vehicleAnglePhotoUrls.front,
            vehicleAnglePhotoUrls.sideLeft,
            vehicleAnglePhotoUrls.sideRight,
            vehicleAnglePhotoUrls.rear,
            extraVehiclePhotoUrls.dekra,
            extraVehiclePhotoUrls.plate,
            extraVehiclePhotoUrls.marchamo,
            extraVehiclePhotoUrls.vinSticker,
            circulationCardUrl,
          ].filter(Boolean) as string[];
          if (
            coverUrls.length === 0 &&
            vehiclePhotoUrl &&
            !vehicleAnglePhotoUrls.front
          ) {
            coverUrls.push(vehiclePhotoUrl);
          }
          if (coverUrls.length === 0) return null;
          return (
            <View style={[styles.photoRow, { marginTop: 16 }]}>
              {coverUrls.map((url, i) => (
                <View key={`cov-${i}`} style={styles.photoThumbWrap}>
                  <Image src={url} style={styles.photoThumb} />
                </View>
              ))}
            </View>
          );
        })()}
      </Page>

      {sections
        .filter((sec) => sec.table !== "section_finalizacion")
        .map((sec) => {
          const cfg = SECTIONS_CONFIG.find((c) => c.table === sec.table);
          if (!cfg) return null;
          const findings = countFindingsInDoc(sec.doc, sec.table);
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
                const signed = pdfItemValueIsPositive(item, line);
                const valueStyle =
                  signed === true
                    ? styles.good
                    : signed === false
                      ? styles.repair
                      : line.value === "No" ||
                          line.value === "Atención" ||
                          line.value.includes("atención") ||
                          line.value.includes("reparación")
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
              Información importante
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
