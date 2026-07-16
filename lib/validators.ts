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
  // Matrícula Gigi's (opcional al alta). Si se deja vacía, el usuario se genera del nombre.
  matricula: z.string().trim().optional().or(z.literal("")),
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
  // Datos de la actividad (se reciben como texto del formulario)
  schedule: z.string().trim().optional(),
  type: z.string().trim().optional(),
  ageMin: z.string().trim().optional().or(z.literal("")),
  ageMax: z.string().trim().optional().or(z.literal("")),
  studentCapacity: z.string().trim().optional().or(z.literal("")),
  collaboratorCapacity: z.string().trim().optional().or(z.literal("")),
  teacherId: z.string().trim().optional().or(z.literal("")),
});

export const EnrollmentSchema = z.object({
  studentId: z.string().min(1),
  programId: z.string().min(1, { message: "Selecciona un programa." }),
  status: z.enum(["ACTIVA", "PAUSADA", "FINALIZADA"]).default("ACTIVA"),
  notes: z.string().trim().optional(),
});

/** Formulario de primer ingreso del tutor: datos básicos + salud + consentimientos. */
export const OnboardingSchema = z.object({
  // Datos básicos del participante
  birthDate: z
    .string()
    .trim()
    .min(1, { message: "La fecha de nacimiento es obligatoria." }),
  gender: z.enum(["FEMENINO", "MASCULINO", "OTRO"], {
    message: "Selecciona el sexo del participante.",
  }),
  // Tutor / contacto
  guardianName: z.string().trim().min(1, { message: "El nombre del tutor es obligatorio." }),
  guardianPhone: z.string().trim().min(1, { message: "El teléfono del tutor es obligatorio." }),
  guardianEmail: z
    .string()
    .trim()
    .email({ message: "Correo del tutor no válido." })
    .optional()
    .or(z.literal("")),
  address: z.string().trim().optional(),
  // Cuestionario de salud
  bloodType: z.string().trim().optional(),
  allergies: z.string().trim().min(1, { message: "Indica las alergias (o escribe “Ninguna”)." }),
  medications: z.string().trim().optional(),
  medicalConditions: z.string().trim().optional(),
  therapies: z.string().trim().optional(),
  dietaryRestrictions: z.string().trim().optional(),
  doctorName: z.string().trim().optional(),
  doctorPhone: z.string().trim().optional(),
  emergencyName: z
    .string()
    .trim()
    .min(1, { message: "El contacto de emergencia es obligatorio." }),
  emergencyPhone: z
    .string()
    .trim()
    .min(1, { message: "El teléfono de emergencia es obligatorio." }),
  emergencyRelation: z.string().trim().optional(),
  healthNotes: z.string().trim().optional(),
  // Consentimientos (checkbox: "on" cuando está marcado)
  acceptPrivacy: z.string().optional(),
  acceptRules: z.string().optional(),
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
