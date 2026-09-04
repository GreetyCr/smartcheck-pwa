# Handoff — Arreglar la calidad de `smartcheck-pwa`

> **Para el próximo agente.** Todo lo de acá está verificado corriendo los comandos contra el repo,
> no leído de otro documento. Corte: **4-set-2026**, `main` @ `00faec1`, árbol limpio.
>
> Si algo de este documento contradice al código, **gana el código**: esto es un mapa, no la fuente.

---

## 0. Antes de tocar nada

Cinco cosas que no se deducen leyendo el repo y que, si se ignoran, hacen daño real:

1. **Usar `pnpm`, nunca `npm`.** Hay `pnpm-lock.yaml`; mezclar gestores rompe `node_modules` con un
   `Cannot read properties of null (reading 'matches')` que no se explica solo.

2. **Este repo está en producción y el cliente lo usa todos los días.** La PWA es con la que Sergio
   hace inspecciones en la calle, y `/admin` es el panel de BI que Esteban abre a diario. No hay
   ventana de mantenimiento.

3. **Convex se despliega A MANO y VA PRIMERO.** Vercel solo corre `next build`. La secuencia es
   `npx convex deploy -y` → `git push origin main`. **Nada de lo que pide este handoff toca `convex/`
   funcionalmente**, salvo la Tarea 2, que solo cambia tipos — pero si por algo terminás modificando
   una función de Convex, respetá el orden.

4. **Nada de lo que vas a arreglar está bloqueando un deploy hoy.** `pnpm build` sale en verde y
   Vercel despliega sin quejarse: Next 16 ya no corre ESLint durante el build. Eso significa que
   tenés margen para hacerlo bien, y también que **nadie se va a enterar si lo hacés mal**.

5. **El porqué de casi todo vive en otro repo.** Los comentarios del código citan decisiones por id
   (`A35`, `A56`, `A77`…). El registro está en `~/Developer/SmartCheck-BI-Proyecto/LOG.md`:

   ```sh
   grep -n "A56" ~/Developer/SmartCheck-BI-Proyecto/LOG.md
   ```

   Consultalo **antes** de "arreglar" cualquier cosa que parezca arbitraria. Buena parte de lo raro
   está razonado ahí, con el incidente que lo originó.

---

## 1. Estado verificado

| Comando | Resultado | Detalle |
|---|---|---|
| `pnpm lint` | ❌ **falla** | 58 problemas: **34 errores**, 24 warnings · exit 1 |
| `pnpm build` | ✅ pasa | exit 0 — no corre ESLint |
| `pnpm test` | ❌ **falla** | 2 de 621 · 1 archivo de 49 |
| CI | ❌ **no existe** | no hay `.github/workflows` |

Los 34 errores, por regla:

| Regla | N.º | Dónde |
|---|---:|---|
| `@typescript-eslint/no-explicit-any` | 32 | todos en `convex/bi/` |
| `react-hooks/purity` | 1 | `app/(dashboard)/page.tsx:47` |
| `@next/next/no-html-link-for-pages` | 1 | `app/~offline/page.tsx:14` |

---

## 2. El orden importa

No es una lista de deseos: **1 habilita a 4**, y 4 sin 1 y 2 nace en rojo.

1. Arreglar los dos tests rojos.
2. `any` → `unknown` en `convex/bi/`.
3. Los dos errores restantes.
4. Encender el CI.
5. Limpieza de warnings.

---

## Tarea 1 — Los dos tests rojos · ~30 min

**Dónde:** `hooks/__tests__/useUnifiedInspection.test.tsx`, casos
`status ready con resolution.kind convex y convexId presente` y `ref vacío → idle sin llamar a Convex`.

**Qué pasa:** los dos fallan con `useSync must be used within SyncProvider`.

**Por qué:** el 1 de junio, el commit `8b6f2c2` («no perder secciones al sincronizar reporte online»)
hizo que `useUnifiedInspection` llamara a `useSync()` — está en `hooks/useUnifiedInspection.ts:44`:

```ts
const { isOnline, pendingCount, lastSyncAt } = useSync();
```

El test renderiza el hook sin envolverlo en `SyncProvider`, así que el contexto es `undefined` y
`useSync` lanza. **El test no se toca desde el 15 de mayo.** Llevan **tres meses rojos** y nadie se
enteró porque no hay CI.

**No es un bug de producto.** Es el test que se quedó atrás cuando el hook creció una dependencia.
Pero es el hook del flujo unificado local-first, que es la línea de trabajo activa — el peor lugar
para no tener red.

**Cómo arreglarlo:** el archivo ya mockea `convex/react` con `vi.mock`. Seguir el mismo patrón y
mockear el contexto, que es más simple que montar el provider real (que abre IndexedDB y arranca la
cola de sync):

```ts
vi.mock("@/contexts/SyncContext", () => ({
  useSync: () => ({ isOnline: true, pendingCount: 0, lastSyncAt: null }),
}));
```

El hook solo consume esas tres propiedades. Si querés cubrir el camino offline, parametrizá el mock
en vez de fijarlo.

**Verificar:**

```sh
pnpm test hooks/__tests__/useUnifiedInspection.test.tsx
```

**Terminado cuando:** `pnpm test` da **621 en verde, 0 rojas**.

---

## Tarea 2 — Los 32 `any` de `convex/bi/` · ~1 h

**Dónde:**

| Archivo | Errores |
|---|---:|
| `convex/bi/leadsSync.ts` | 20 |
| `convex/bi/metrics.ts` | 5 |
| `convex/bi/matches.ts` | 3 |
| `convex/bi/leadsReconcile.ts` | 2 |
| `convex/bi/legacy.ts` | 2 |

**Qué son:** helpers que coercionan campos crudos de Airtable, del estilo

```ts
const str = (val: any): string | undefined => { … }
const num = (val: any): number | undefined => { … }
function mapChannel(fuente: any, origen: any) { … }
```

Es el caso clásico de parsear JSON ajeno que no trae tipos.

**El contexto que cambia la decisión:** **este código es interino.** El sync de Airtable se retira en
el cutover a full-Convex — está anotado en `convex/crons.ts` y en la decisión `A35`. Inventar tipos de
Airtable para 32 firmas que se van a borrar es trabajo que se tira.

**Cómo arreglarlo:** cambiar `any` por `unknown`. Esas funciones ya narran el tipo hacia adentro
(comprueban `typeof`, hacen `String(...)`, devuelven `undefined` cuando no aplica), así que el cambio
es casi mecánico. **`unknown` obliga a comprobar antes de usar, que es justo lo que ya hacen.**

Donde `unknown` obligue a escribir una comprobación que no existía, **escribila** — probablemente
estabas confiando en algo que Airtable no garantiza.

**Si sale más caro de lo que parece**, la alternativa honesta es un `eslint-disable` **por archivo,
con la razón escrita** («mapeo de campos crudos de Airtable, interino hasta el cutover — A35»). Deja
claro que es deuda deliberada y no descuido. Lo que **no** vale es un disable sin razón.

**Verificar:**

```sh
pnpm lint 2>&1 | grep -c "no-explicit-any"   # esperado: 0
pnpm test tests/convex/                       # las pruebas de BI siguen verdes
pnpm build                                    # el type-check real del proyecto
```

**Terminado cuando:** cero errores `no-explicit-any` y las pruebas de `tests/convex/` intactas.

---

## Tarea 3 — Los dos errores restantes · ~30 min

### 3a · `Date.now()` dentro de un `useMemo` — el único con consecuencia visible

**Dónde:** `app/(dashboard)/page.tsx:47` · regla `react-hooks/purity`.

```ts
const lastSyncLabel = useMemo(() => {
  if (!lastSyncAt) return "Última hace —";
  const diff = Date.now() - lastSyncAt.getTime();   // ← acá
  …
```

**Qué pasa:** es la etiqueta «Última sync hace X min» del dashboard del técnico. Al calcularse dentro
de un `useMemo`, el valor queda congelado hasta que otra cosa provoque un render: **el técnico puede
estar viendo "hace 2 min" cuando ya pasaron veinte.** En una app cuyo propósito es saber si lo que se
llenó en campo ya subió, esa etiqueta miente justo cuando más importa.

**Cómo arreglarlo:** sacar el reloj del memo. Un `useState` con `setInterval` que refresque cada
30–60 s es lo más directo; limpiá el intervalo en el `return` del efecto.

**Verificar:** abrir el dashboard, dejarlo quieto un minuto y confirmar que la etiqueta avanza sola.

### 3b · El enlace de la pantalla offline — probablemente ya está bien

**Dónde:** `app/~offline/page.tsx:14` · regla `@next/next/no-html-link-for-pages`.

La regla pide `<Link>` en vez de `<a href="/">`. Pero en la pantalla de «estás sin conexión», un
`<a>` fuerza **navegación real contra la red**, que es exactamente lo que se quiere ahí: reintentar.
Un `<Link>` haría una transición de cliente que no prueba nada.

**Cómo resolverlo:** si es deliberado —y todo indica que sí—, poner
`// eslint-disable-next-line @next/next/no-html-link-for-pages` **con esa frase como razón**. No lo
cambies a `<Link>` sin pensarlo: la regla acá está equivocada, no el código.

---

## Tarea 4 — Encender el CI · ~30 min

**Dónde:** no existe `.github/workflows`. Repo: `GreetyCr/smartcheck-pwa`.

**Por qué importa más que todo lo anterior:** los comandos están bien definidos, pero solo corren si
alguien se acuerda. Tres meses de test rojo no son descuido de nadie: son lo que pasa cuando la
verificación es voluntaria.

**Cómo:** un workflow que en cada push y PR corra `pnpm install --frozen-lockfile`, `pnpm test` y
`pnpm lint`. Node 20+, pnpm por `corepack`.

> **El orden es la parte delicada.** Hoy `pnpm lint` sale con código 1. Encender el CI con el lint
> incluido **antes** de las tareas 1–3 deja todo PR en rojo desde el primer minuto, que es la forma
> más rápida de que el equipo aprenda a ignorar el CI. Si por lo que sea vas a encenderlo antes,
> arrancá **solo con `pnpm test`** y sumá el lint cuando los 34 errores estén en cero.

**No pongas `pnpm build` en el CI todavía** sin hablarlo: necesita variables de entorno de Convex y
Clerk, y un build que falla por falta de secretos enseña a ignorar el rojo igual que un lint sucio.

**Terminado cuando:** un push a una rama produce un check verde, y romper una prueba a propósito lo
pone en rojo. **Comprobá las dos direcciones** — un CI que nunca falla no es un CI.

---

## Tarea 5 — Los 24 warnings · ~30 min, opcional

| Regla | N.º | Qué hacer |
|---|---:|---|
| `react-hooks/set-state-in-effect` | 10 | **Dejar como está.** |
| `@typescript-eslint/no-unused-vars` | 6 | Limpiar (ver abajo). |
| `react-hooks/exhaustive-deps` | 4 | Mirar caso por caso. |
| `react-hooks/refs` | 2 | **Dejar como está.** |
| `@next/next/no-img-element` | 2 | Opcional. |

**Las doce de `react-hooks` están así a propósito.** `eslint.config.mjs` las degrada a `warn` porque
con formularios + Convex + IndexedDB daban más ruido que señal. **No las subas a `error`** sin medir
antes cuánto rompen.

**Las seis variables sin usar son limpieza real:**

```
contexts/SyncContext.tsx:13        'Id'
convex/inspections.ts:9            'requireAdmin'
hooks/useOfflineInspection.ts:115  'db'
hooks/useOfflineInspection.ts:186  'db'
hooks/usePhotoUpload.ts:12         'enqueuePhotoQueue'
hooks/usePhotoUpload.ts:15         'PhotoQueueRow'
```

Dos merecen una mirada antes de borrarlas, no un borrado automático:

- **`convex/inspections.ts:9 — `requireAdmin` importado y no usado.** En un archivo de Convex que
  expone funciones, un helper de autorización importado y sin usar puede ser un control que se cayó
  en un refactor. **Revisá si alguna función de ese archivo debería estar exigiendo admin y no lo
  está haciendo.** Si el import sobra de verdad, borralo; si falta la llamada, eso ya no es limpieza.
- **`hooks/usePhotoUpload.ts` — `enqueuePhotoQueue` y `PhotoQueueRow`.** Huele a refactor a medio
  camino en la cola de fotos. Mirá si la funcionalidad se movió o se perdió.

**Los cuatro `exhaustive-deps`** están en `components/bi/PayrollMonthCard.tsx:107`,
`components/inspection/InspectionCabeceraScreen.tsx:393`,
`components/providers/ConvexClientProvider.tsx:54` y `hooks/usePhotoUpload.ts:270`. Este último dice
tener dependencias **innecesarias**, que es el caso barato. Los otros tres, uno por uno: agregar una
dependencia puede cambiar el comportamiento en tiempo de ejecución.

---

## Tarea 6 — La deprecación con fecha de vencimiento

**Dónde:** `vitest.config.mjs`, campo `environmentMatchGlobs`.

Vitest ya avisa que está deprecado y pide migrar a `test.projects`. Hoy solo imprime una línea, pero
**es la pieza que le da a `tests/convex/**` el runtime `edge-runtime`** y a `hooks/__tests__/**`
`happy-dom`. El día que desaparezca, esos 28 archivos de test van a fallar por el entorno equivocado,
y el mensaje no se va a parecer en nada a la causa.

No urge. Pero si lo hacés, **verificá que cada proyecto conserva su entorno**: mové, corré la suite
completa y confirmá que siguen siendo 621.

---

## Reglas mientras trabajás

- **Verificá en las dos direcciones.** Que la prueba pase no dice nada si no comprobaste que se cae
  cuando debe. Rompé la regla a mano y confirmá que **la prueba correcta** falla.
- **No concluyas contra el entorno de desarrollo.** DEV tiene un subconjunto viejo de los datos.
  Cualquier cifra que vaya a un documento se lee de PROD.
- **Leé antes de escribir**, si algo termina tocando datos vivos. Y nunca la primera vez contra PROD.
- **Un dato de ejemplo dentro del código no es un dato falso.** Los comentarios de este repo tienen
  teléfonos que resultaron ser de clientes reales (decisión `A77`). Para pruebas contra datos vivos,
  valores imposibles por construcción, con prefijo `qa-smoke-`.

## Lo que NO hay que hacer

- **No toques la configuración de ESLint** para hacer callar los errores. El objetivo es cero
  errores reales, no cero salida.
- **No subas las reglas de `react-hooks` a `error`.**
- **No metas `pnpm build` en el CI** sin resolver antes lo de los secretos.
- **No refactorices `convex/bi/` más allá de los tipos.** Está al 97%, en producción y verificado
  contra datos reales. La Tarea 2 es un cambio de tipos, no una oportunidad de mejora.
- **No borres el `<a>` de la pantalla offline** sin leer 3b.

## Fuera de alcance de este handoff

- **RNF-04 — probar el panel en un teléfono real.** Las once pantallas están medidas a 375 px con
  cero desbordes, pero ninguna se probó en un dispositivo físico: el emulador no reproduce el teclado
  ni el gesto. **Esto solo lo puede hacer Greety**, no un agente.
- **`tests/convex/inspections.test.ts` intermitente.** Se pasa de los 5 s cuando corre toda la suite
  en paralelo y pasa siempre en aislado. **No es una falla real**; está anotado y no se persigue.

---

## Definición de terminado

- [ ] `pnpm test` → **621 en verde, 0 rojas**
- [ ] `pnpm lint` → **0 errores** (los warnings de `react-hooks` pueden quedarse)
- [ ] `pnpm build` → exit 0, como hasta ahora
- [ ] CI encendido, y **verificado que se pone rojo** cuando algo se rompe
- [ ] La etiqueta de última sincronización del dashboard avanza sola
- [ ] Ningún `eslint-disable` nuevo sin su razón escrita al lado
- [ ] Un commit por tarea, en español, como el resto del repo

**Y antes de cerrar la sesión:** anotá las horas en la bitácora de Costa Coders,
`~/Documents/Obsidian Vault/2. Areas/Costa Coders/Operación/Bitácora/AAAA-MM.md`, con el formato
`- AAAA-MM-DD · ~Nh · SmartCheck CR · <qué se hizo>`. Es el único insumo que existe para saber cuánto
toma de verdad cada cosa, y de ahí sale el precio. Sin esa línea, el trabajo ocurrió pero no se puede
cotizar.
