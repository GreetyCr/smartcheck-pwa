const transmission: Record<string, string> = {
  automatico_2wd: "Automático 2WD",
  automatico_4wd: "Automático 4WD",
  manual_2wd: "Manual 2WD",
  manual_4wd: "Manual 4WD",
};

const engine: Record<string, string> = {
  gasolina: "Gasolina",
  diesel: "Diésel",
  electrico: "Eléctrico",
  hibrido: "Híbrido",
};

const country: Record<string, string> = {
  estados_unidos: "Estados Unidos",
  corea: "Corea",
  japon: "Japón",
  alemania: "Alemania",
  mexico: "México",
  otro: "Otro",
};

export function labelTransmission(v: string | undefined): string {
  if (!v) return "—";
  return transmission[v] ?? v;
}

export function labelEngine(v: string | undefined): string {
  if (!v) return "—";
  return engine[v] ?? v;
}

export function labelCountry(v: string | undefined): string {
  if (!v) return "—";
  return country[v] ?? v;
}
