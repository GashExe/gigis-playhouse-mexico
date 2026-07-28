-- Roles nuevos y calificación inicial/final
-- ==========================================
-- Este proyecto aplica el esquema con `prisma db push`, pero ESTE cambio no se puede
-- empujar directo: quita un valor del enum Role (MAESTRA) que las cuentas todavía
-- están usando, y `db push` no sabe a qué convertirlas. Por eso el orden es:
--
--   1) npm run db:migrar-roles   ← corre este archivo (o pégalo en el editor SQL de Supabase)
--   2) npx prisma db push        ← recién entonces; borra las tablas de plantillas
--   3) npm run db:seed-lectores  ← alta de Mallely Martínez y Reyna Huerta
--
-- El paso 2 BORRA EvalBlock, EvalItem, ItemScore y TemplatePreset con todo lo que
-- tengan dentro (las calificaciones tema por tema de ciclos pasados). Saca respaldo
-- de la base antes de correrlo.
--
-- Cada sentencia va suelta y es idempotente: correr el archivo dos veces no rompe
-- nada. Nada de BEGIN/COMMIT aquí — en Postgres `ALTER TYPE ... ADD VALUE` no puede
-- ir dentro de una transacción junto con el UPDATE que usa el valor nuevo.

-- 1. Roles nuevos.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'GESTORA_OPERACIONES';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'TERAPEUTA';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'LECTOR';

-- 2. Maestra pasa a llamarse terapeuta. Nadie queda en MAESTRA, y así `db push`
--    puede quitar ese valor del enum sin dejar filas huérfanas.
UPDATE "User" SET "role" = 'TERAPEUTA' WHERE "role" = 'MAESTRA';

-- 3. La calificación del ciclo: inicial y final (1–4) sobre la ubicación de nivel.
ALTER TABLE "LevelRecord" ADD COLUMN IF NOT EXISTS "initialScore" INTEGER;
ALTER TABLE "LevelRecord" ADD COLUMN IF NOT EXISTS "finalScore" INTEGER;

-- 4. Primera vez que la cuenta vio el video tutorial (null = todavía no).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tutorialSeenAt" TIMESTAMP(3);

-- Lo demás lo hace `npx prisma db push`:
--   · quita MAESTRA del enum Role
--   · quita Program.evalFormat y Program.passThreshold, y el enum EvalFormat
--   · borra las tablas EvalBlock, EvalItem, ItemScore y TemplatePreset
