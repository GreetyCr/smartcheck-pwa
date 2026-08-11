"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { SignOutButton } from "@clerk/nextjs";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Car,
  Filter,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ==========================================================================
   Navegación del panel — agrupada por DOMINIO
   --------------------------------------------------------------------------
   La lista plana de 5 ítems no escala: en la Semana 6 entran más tableros del
   BI (Resumen ejecutivo, Leads & conversión, Ingresos por canal, Calidad) y
   todos son "Negocio", no "Operación". Agrupar ahora evita tener que reordenar
   el menú cada vez que se suma un tablero.

   `Inicio` queda FUERA de los grupos a propósito: es la portada transversal del
   panel, no un dominio. Cuando exista el "Resumen ejecutivo" del BI entrará en
   `Negocio` sin competir con ella.

   Regla: acá solo van rutas que existen. Nada de links muertos "próximamente".
   ========================================================================== */

type NavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
  /** Coincidencia exacta (para `/admin`, que es prefijo de todo lo demás). */
  exact?: boolean;
  /** Muestra el contador de técnicos pendientes de aprobación. */
  showApprovals?: boolean;
};

type NavGroup = { label: string; items: NavItem[] };

const HOME: NavItem = {
  href: "/admin",
  label: "Inicio",
  Icon: LayoutDashboard,
  exact: true,
};

const GROUPS: NavGroup[] = [
  {
    label: "Negocio",
    items: [
      { href: "/admin/finanzas", label: "Finanzas", Icon: LineChart },
      { href: "/admin/leads", label: "Leads", Icon: Filter },
    ],
  },
  {
    label: "Operación",
    items: [
      { href: "/admin/inspecciones", label: "Inspecciones", Icon: Car },
      {
        href: "/admin/tecnicos",
        label: "Técnicos",
        Icon: Users,
        showApprovals: true,
      },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/admin/configuracion", label: "Configuración", Icon: Settings },
    ],
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/* -------------------------------------------------------------------------- */

/**
 * Un ítem de navegación. Altura mínima 44px (objetivo táctil de la WCAG 2.5.5)
 * y el estado activo se comunica por **tres** vías, no solo por color:
 * `aria-current="page"`, barra de acento a la izquierda y peso tipográfico.
 */
function NavLink({
  item,
  active,
  pendingApprovals,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  pendingApprovals: number;
  onNavigate: () => void;
}) {
  const { href, label, Icon, showApprovals } = item;
  const badge = showApprovals && pendingApprovals > 0 ? pendingApprovals : null;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bi-plane)]",
        active
          ? "bg-[var(--bi-surface-2)] font-semibold text-[var(--bi-ink)]"
          : "font-medium text-[var(--bi-ink-2)] hover:bg-[var(--bi-surface)] hover:text-[var(--bi-ink)]",
      )}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-[var(--bi-income)]"
        />
      ) : null}
      <Icon
        className={cn(
          "size-4 shrink-0",
          active ? "text-[var(--bi-income)]" : "text-[var(--bi-ink-3)]",
        )}
        aria-hidden
      />
      <span className="flex flex-1 items-center justify-between gap-2">
        <span className="truncate">{label}</span>
        {badge !== null ? (
          <span className="bi-num rounded-full bg-[var(--bi-warn)] px-1.5 py-px text-[10px] font-bold text-[#2a1d00]">
            {badge}
            <span className="sr-only"> pendientes de aprobación</span>
          </span>
        ) : null}
      </span>
    </Link>
  );
}

/** Cuerpo compartido por el sidebar de escritorio y el drawer móvil. */
function NavBody({
  pendingApprovals,
  onNavigate,
  activePath,
}: {
  pendingApprovals: number;
  onNavigate: () => void;
  activePath?: string;
}) {
  const realPath = usePathname();
  const pathname = activePath ?? realPath;

  return (
    <>
      <div className="border-b border-[var(--bi-ring)] px-4 py-4">
        <Link
          href="/admin"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]"
        >
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bi-surface-2)] text-lg"
          >
            🚗
          </span>
          <span className="min-w-0">
            <span className="bi-display block text-[15px] font-bold uppercase leading-tight tracking-wide text-[var(--bi-ink)]">
              Smartcheck
            </span>
            <span className="bi-num block text-[10px] uppercase tracking-[0.14em] text-[var(--bi-ink-3)]">
              Panel admin
            </span>
          </span>
        </Link>
      </div>

      <nav
        aria-label="Secciones del panel"
        className="flex flex-1 flex-col gap-4 overflow-y-auto p-3"
      >
        <NavLink
          item={HOME}
          active={isActive(pathname, HOME)}
          pendingApprovals={pendingApprovals}
          onNavigate={onNavigate}
        />

        {GROUPS.map((group) => (
          <div key={group.label}>
            {/* El rótulo del grupo es el `aria-label` de su lista: el lector de
                pantalla anuncia "Negocio, lista, 1 elemento". */}
            <p
              className="bi-num px-3 pb-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--bi-ink-3)]"
              id={`admin-nav-${group.label.toLowerCase()}`}
            >
              {group.label}
            </p>
            <ul
              aria-labelledby={`admin-nav-${group.label.toLowerCase()}`}
              className="flex flex-col gap-0.5"
            >
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavLink
                    item={item}
                    active={isActive(pathname, item)}
                    pendingApprovals={pendingApprovals}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--bi-ring)] p-3">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-[var(--bi-ink-2)] transition-colors hover:bg-[var(--bi-surface)] hover:text-[var(--bi-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]"
        >
          <ArrowLeft className="size-4 shrink-0 text-[var(--bi-ink-3)]" aria-hidden />
          Volver a la app
        </Link>
        <SignOutButton>
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-[var(--bi-ink-2)] transition-colors hover:bg-[var(--bi-surface)] hover:text-[var(--bi-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]"
          >
            <LogOut className="size-4 shrink-0 text-[var(--bi-ink-3)]" aria-hidden />
            Cerrar sesión
          </button>
        </SignOutButton>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Drawer de móvil/tablet. Componente propio (y no un `open ? … : null` dentro
 * del sidebar) para que sus efectos —Escape, bloqueo de scroll, foco— vivan y
 * mueran con el panel abierto.
 */
function MobileDrawer({
  pendingApprovals,
  onClose,
  activePath,
}: {
  pendingApprovals: number;
  onClose: () => void;
  activePath?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Se recuerda quién abrió el menú para devolverle el foco al cerrar: si no,
    // el foco vuelve al `<body>` y el teclado queda al principio de la página.
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    // El fondo no debe scrollear detrás del drawer.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      // Trampa de foco: con `aria-modal` el tabulador no debe salirse del panel.
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Tocar el fondo cierra. Es un `button` para que también responda a
          teclado y quede en el orden de tabulación del panel. */}
      <button
        type="button"
        aria-label="Cerrar menú"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menú del panel admin"
        className={cn(
          "bi-graphite absolute inset-y-0 left-0 flex w-[min(18rem,85%)] flex-col",
          "bg-[var(--bi-plane)] text-[var(--bi-ink)] shadow-2xl",
        )}
      >
        <div className="flex items-center justify-end border-b border-[var(--bi-ring)] px-2 py-2">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="flex size-11 items-center justify-center rounded-xl text-[var(--bi-ink-2)] transition-colors hover:bg-[var(--bi-surface-2)] hover:text-[var(--bi-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <NavBody
          pendingApprovals={pendingApprovals}
          onNavigate={onClose}
          activePath={activePath}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export type AdminSidebarProps = {
  open: boolean;
  onClose: () => void;
  /** Técnicos esperando aprobación (`api.users.pendingApprovalCount`). */
  pendingApprovals?: number;
  /**
   * Ruta a marcar como activa en vez de la real. Solo para las vistas de
   * revisión de `app/dev/*`, donde la URL no es una ruta de `/admin`.
   */
  activePath?: string;
};

/**
 * Sidebar fijo desde `lg` (≥1024px) y drawer por debajo.
 *
 * El corte está en `lg`, no en `md`: a 768px un sidebar de 256px dejaba 512px
 * para tablas de 720px de ancho mínimo, así que la tablet se comporta como
 * móvil (drawer) y gana todo el ancho para el contenido.
 */
export function AdminSidebar({
  open,
  onClose,
  pendingApprovals = 0,
  activePath,
}: AdminSidebarProps) {
  return (
    <>
      <aside
        className="hidden w-60 shrink-0 flex-col border-r border-[var(--bi-ring)] bg-[var(--bi-plane)] lg:sticky lg:top-0 lg:flex lg:h-dvh xl:w-64"
        aria-label="Navegación principal del panel"
      >
        <NavBody
          pendingApprovals={pendingApprovals}
          onNavigate={() => {}}
          activePath={activePath}
        />
      </aside>

      {open ? (
        <MobileDrawer
          pendingApprovals={pendingApprovals}
          onClose={onClose}
          activePath={activePath}
        />
      ) : null}
    </>
  );
}

/** Barra superior de móvil/tablet: abre el drawer y ubica al usuario. */
export function AdminMobileHeader({
  onMenuClick,
  pendingApprovals = 0,
}: {
  onMenuClick: () => void;
  pendingApprovals?: number;
}) {
  return (
    <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-[var(--bi-ring)] bg-[var(--bi-plane)]/95 px-2 py-2 backdrop-blur lg:hidden">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Abrir menú"
        aria-haspopup="dialog"
        className="relative flex size-11 shrink-0 items-center justify-center rounded-xl text-[var(--bi-ink-2)] transition-colors hover:bg-[var(--bi-surface-2)] hover:text-[var(--bi-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]"
      >
        <Menu className="size-5" aria-hidden />
        {pendingApprovals > 0 ? (
          <>
            {/* El punto avisa que hay algo pendiente detrás del menú cerrado;
                el rótulo oculto lo dice con palabras. */}
            <span
              aria-hidden
              className="absolute right-2 top-2 size-2 rounded-full bg-[var(--bi-warn)]"
            />
            <span className="sr-only">
              {pendingApprovals} técnicos pendientes de aprobación
            </span>
          </>
        ) : null}
      </button>
      <span className="bi-display text-[15px] font-bold uppercase tracking-wide text-[var(--bi-ink)]">
        Smartcheck · Admin
      </span>
    </header>
  );
}
