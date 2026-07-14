import { Badge } from "@/components/ui/badge";
import type {
  StudentStatus,
  EnrollmentStatus,
} from "@/lib/generated/prisma/client";

const studentTone = {
  ACTIVO: "success",
  INACTIVO: "neutral",
  EGRESADO: "info",
} as const;

const studentLabel = {
  ACTIVO: "Activo",
  INACTIVO: "Inactivo",
  EGRESADO: "Egresado",
} as const;

export function StudentStatusBadge({ status }: { status: StudentStatus }) {
  return (
    <Badge tone={studentTone[status]} dot>
      {studentLabel[status]}
    </Badge>
  );
}

const enrollmentTone = {
  ACTIVA: "primary",
  PAUSADA: "warning",
  FINALIZADA: "neutral",
} as const;

const enrollmentLabel = {
  ACTIVA: "Activa",
  PAUSADA: "Pausada",
  FINALIZADA: "Finalizada",
} as const;

export function EnrollmentStatusBadge({ status }: { status: EnrollmentStatus }) {
  return <Badge tone={enrollmentTone[status]}>{enrollmentLabel[status]}</Badge>;
}
