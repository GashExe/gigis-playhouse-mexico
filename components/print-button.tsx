"use client";

import { Printer } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

/** Botón para mandar la página a imprimir o "Guardar como PDF". Se oculta al imprimir. */
export function PrintButton({ label = "Imprimir / PDF" }: { label?: string }) {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={() => window.print()}
      className="print:hidden"
    >
      <Printer weight="fill" className="size-4" />
      {label}
    </Button>
  );
}
