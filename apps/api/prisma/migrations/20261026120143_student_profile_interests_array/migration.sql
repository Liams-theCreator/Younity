/*
  Warnings:

  - Changed the column `interests` on the `student_profiles` table from a scalar field to a list field. If there are non-null values in that column, this step will fail.

*/
-- AlterTable
ALTER TABLE "student_profiles"
  ALTER COLUMN "interests" TYPE "Interests"[]
  USING CASE
    WHEN "interests" IS NULL THEN '{}'::"Interests"[]
    ELSE ARRAY["interests"]
  END,
  ALTER COLUMN "interests" SET DEFAULT '{}'::"Interests"[],
  ALTER COLUMN "interests" SET NOT NULL;
