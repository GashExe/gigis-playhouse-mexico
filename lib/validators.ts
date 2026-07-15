import * as z from "zod";

export const LoginSchema = z.object({
  username: z.string().trim().min(1, { message: "Ingresa tu usuario." }),
  password: z.string().min(1, { message: "Ingresa tu contraseña." }),
});

/** Usuario: minúsculas, sin espacios; solo letras, números y . _ - */
const usernameField = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, { message: "El usuario debe tener al menos 3 caracteres." })
  .max(30, { message: "El usuario es demasiado largo." })
  .regex(/^[a-z0-9._-]+$/, {
    message: "Usa solo letras, números y . _ - (sin espacios).",
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
  username: usernameField,
  email: z
    .string()
    .trim()
    .email({ message: "Correo no válido." })
    .optional()
    .or(z.literal("")),
  role: z.enum(["DIRECTORA", "MAESTRA"]).default("MAESTRA"),
  password: z
    .string()
    .min(8, { message: "La contraseña debe tener al menos 8 caracteres." })
    .optional()
    .or(z.literal("")),
});
