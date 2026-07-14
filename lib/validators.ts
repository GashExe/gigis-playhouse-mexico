import * as z from "zod";

export const LoginSchema = z.object({
  email: z.string().trim().email({ message: "Ingresa un correo válido." }),
  password: z.string().min(1, { message: "Ingresa tu contraseña." }),
});

export const StudentSchema = z.object({
  firstName: z.string().trim().min(1, { message: "El nombre es obligatorio." }),
  lastName: z.string().trim().min(1, { message: "El apellido es obligatorio." }),
  birthDate: z.string().trim().optional().or(z.literal("")),
  gender: z.enum(["FEMENINO", "MASCULINO", "OTRO"]).optional().or(z.literal("")),
  guardianName: z.string().trim().optional(),
  guardianPhone: z.string().trim().optional(),
  guardianEmail: z
    .string()
    .trim()
    .email({ message: "Correo del tutor no válido." })
    .optional()
    .or(z.literal("")),
  address: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  status: z.enum(["ACTIVO", "INACTIVO", "EGRESADO"]).default("ACTIVO"),
});

export const ProgramSchema = z.object({
  name: z.string().trim().min(1, { message: "El nombre es obligatorio." }),
  description: z.string().trim().optional(),
  area: z.string().trim().optional(),
  color: z.string().trim().optional(),
});

export const EnrollmentSchema = z.object({
  studentId: z.string().min(1),
  programId: z.string().min(1, { message: "Selecciona un programa." }),
  status: z.enum(["ACTIVA", "PAUSADA", "FINALIZADA"]).default("ACTIVA"),
  notes: z.string().trim().optional(),
});

export const EvaluationSchema = z.object({
  studentId: z.string().min(1),
  programId: z.string().trim().optional().or(z.literal("")),
  title: z.string().trim().min(1, { message: "Ponle un título a la evaluación." }),
  date: z.string().trim().optional().or(z.literal("")),
  score: z.string().trim().optional().or(z.literal("")),
  scale: z.string().trim().optional(),
  level: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const UserSchema = z.object({
  name: z.string().trim().min(1, { message: "El nombre es obligatorio." }),
  email: z.string().trim().email({ message: "Correo no válido." }),
  role: z.enum(["DIRECTORA", "MAESTRA"]).default("MAESTRA"),
  password: z
    .string()
    .min(8, { message: "La contraseña debe tener al menos 8 caracteres." })
    .optional()
    .or(z.literal("")),
});
