CREATE TYPE "UserRole" AS ENUM (
  'STUDENT',
  'ORGANIZER',
  'ADMIN'
);

CREATE TYPE "UserStatus" AS ENUM (
  'PENDING',
  'ACTIVE',
  'SUSPENDED'
);

CREATE TYPE "AcademicField" AS ENUM (
  'COMPUTER_SCIENCE',
  'BUSINESS_MGMT',
  'ENGINEERING_ROBOTICS',
  'HEALTHCARE_BIOTECH',
  'ARTS_DESIGN',
  'LAW_SOCIAL_SCIENCES',
  'ENVIRONMENT_ARGO'
);

CREATE TYPE "OppotunityFormat" AS ENUM (
  'IN_PERSON',
  'ONLINE',
  'HYBRID'
);

CREATE TYPE "AcademicLevel" AS ENUM (
  'FIRST_YEAR',
  'SECOND_YEAR',
  'MASTER',
  'PHD'
);

CREATE TYPE "Interests" AS ENUM (
  'HACKATHONS',
  'AI_DATA',
  'STARTUPS_ENTR',
  'ROBOTICS_IOT',
  'UI_UX_DESIGN',
  'PUBLIC_SPEAKING',
  'SOCIAL_IMPACT_NGOS',
  'FINTECH',
  'SCIENTIFIC_RESEARCH',
  'CAREER_FAIRS_NETWORKING'
);

CREATE TYPE "OrganizationType" AS ENUM (
  'UNIVERSITY',
  'STUDENT_CLUB',
  'NGO',
  'ASSOCIATION',
  'COMPANY',
  'COMMUNITY',
  'OTHER'
);

CREATE TYPE "VerificationStatus" AS ENUM (
  'PENDING',
  'NEEDS_CHANGES',
  'APPROVED',
  'REJECTED'
);

CREATE TYPE "EventFormat" AS ENUM (
  'IN_PERSON',
  'ONLINE',
  'HYBRID'
);

CREATE TYPE "EventStatus" AS ENUM (
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'FULL',
  'CANCELLED',
  'COMPLETED'
);

CREATE TYPE "RegistrationMode" AS ENUM (
  'AUTOMATIC',
  'EXTERNAL'
);

CREATE TYPE "NotificationType" AS ENUM (
  'ORGANIZATION_APPROVED',
  'ORGANIZATION_REJECTED',
  'ORGANIZATION_NEEDS_CHANGES',
  'EVENT_PUBLISHED',
  'EVENT_UPDATED',
  'EVENT_CANCELLED',
  'REGISTRATION_PENDING',
  'REGISTRATION_CONFIRMED',
  'REGISTRATION_REJECTED',
  'REGISTRATION_CANCELLED',
  'REGISTRATION_REMINDER'
);

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY,
  "last_name" varchar(100) NOT NULL,
  "first_name" varchar(100) NOT NULL,
  "email" varchar(255) UNIQUE NOT NULL,
  "password_hash" varchar(255) NOT NULL,
  "role" "UserRole" NOT NULL,
  "status" "UserStatus" NOT NULL,
  "email_verified_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

CREATE TABLE "student_profiles" (
  "user_id" uuid PRIMARY KEY,
  "university" varchar(255),
  "academic_field" "AcademicField",
  "study_level" "AcademicLevel",
  "interests" "Interests",
  "opportunity_format" "OppotunityFormat",
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

CREATE TABLE "organizations" (
  "id" uuid PRIMARY KEY,
  "owner_id" uuid NOT NULL,
  "org_name" varchar(255) NOT NULL,
  "type" "OrganizationType" NOT NULL,
  "representative_FullName" varchar(255) NOT NULL,
  "academic_position" varchar(255) NOT NULL,
  "proof_url" varchar(512),
  "phone_number" varchar(255) NOT NULL,
  "verification_status" "VerificationStatus" NOT NULL,
  "verified_at" timestamp,
  "verified_by_id" uuid,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

CREATE TABLE "organization_applications" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "submitted_by_id" uuid NOT NULL,
  "reviewer_id" uuid,
  "status" "VerificationStatus" NOT NULL,
  "reviewer_note" text,
  "submitted_at" timestamp NOT NULL,
  "reviewed_at" timestamp
);

CREATE TABLE "events" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "created_by_id" uuid NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text NOT NULL,
  "format" "EventFormat" NOT NULL,
  "location" varchar(500),
  "online_url" varchar(500),
  "image_url" varchar(500),
  "start_date" timestamp NOT NULL,
  "end_date" timestamp NOT NULL,
  "registration_deadline" timestamp,
  "capacity" integer,
  "registration_mode" "RegistrationMode" NOT NULL,
  "external_registration_url" varchar(500),
  "status" "EventStatus" NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

CREATE TABLE "categories" (
  "id" uuid PRIMARY KEY,
  "name" varchar(100) UNIQUE NOT NULL,
  "slug" varchar(120) UNIQUE NOT NULL,
  "created_at" timestamp NOT NULL
);

CREATE TABLE "event_categories" (
  "event_id" uuid NOT NULL,
  "category_id" uuid NOT NULL,
  PRIMARY KEY ("event_id", "category_id")
);

CREATE TABLE "student_interests" (
  "student_id" uuid NOT NULL,
  "category_id" uuid NOT NULL,
  "created_at" timestamp NOT NULL,
  PRIMARY KEY ("student_id", "category_id")
);

CREATE TABLE "event_registrations" (
  "id" uuid PRIMARY KEY,
  "event_id" uuid NOT NULL,
  "student_id" uuid NOT NULL,
  "status" "RegistrationStatus" NOT NULL,
  "registered_at" timestamp NOT NULL,
  "reviewed_at" timestamp,
  "reviewed_by_id" uuid,
  "cancellation_reason" text,
  "updated_at" timestamp NOT NULL
);

CREATE TABLE "notifications" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" varchar(255) NOT NULL,
  "message" text NOT NULL,
  "event_id" uuid,
  "organization_id" uuid,
  "is_read" boolean NOT NULL,
  "read_at" timestamp,
  "created_at" timestamp NOT NULL
);

CREATE TABLE "organization_follows" (
  "follower_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "created_at" timestamp NOT NULL,
  PRIMARY KEY ("follower_id", "organization_id")
);

CREATE INDEX ON "organizations" ("owner_id");

CREATE INDEX ON "organization_applications" ("organization_id");

CREATE INDEX ON "organization_applications" ("submitted_by_id");

CREATE INDEX ON "organization_applications" ("reviewer_id");

CREATE INDEX ON "events" ("organization_id");

CREATE INDEX ON "events" ("created_by_id");

CREATE INDEX ON "events" ("status");

CREATE INDEX ON "events" ("start_date");

CREATE INDEX ON "events" ("registration_deadline");

CREATE UNIQUE INDEX ON "event_registrations" ("student_id", "event_id");

CREATE INDEX ON "event_registrations" ("event_id");

CREATE INDEX ON "event_registrations" ("student_id");

CREATE INDEX ON "event_registrations" ("status");

CREATE INDEX ON "notifications" ("user_id");

CREATE INDEX ON "notifications" ("event_id");

CREATE INDEX ON "notifications" ("organization_id");

CREATE INDEX ON "notifications" ("is_read");

ALTER TABLE "users" ADD FOREIGN KEY ("id") REFERENCES "student_profiles" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "organizations" ADD FOREIGN KEY ("owner_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "organizations" ADD FOREIGN KEY ("verified_by_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "organization_applications" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "organization_applications" ADD FOREIGN KEY ("submitted_by_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "organization_applications" ADD FOREIGN KEY ("reviewer_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "events" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "events" ADD FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "event_categories" ADD FOREIGN KEY ("event_id") REFERENCES "events" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "event_categories" ADD FOREIGN KEY ("category_id") REFERENCES "categories" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "student_interests" ADD FOREIGN KEY ("student_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "student_interests" ADD FOREIGN KEY ("category_id") REFERENCES "categories" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "event_registrations" ADD FOREIGN KEY ("student_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "event_registrations" ADD FOREIGN KEY ("event_id") REFERENCES "events" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "event_registrations" ADD FOREIGN KEY ("reviewed_by_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "notifications" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "notifications" ADD FOREIGN KEY ("event_id") REFERENCES "events" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "notifications" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "organization_follows" ADD FOREIGN KEY ("follower_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "organization_follows" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

CREATE TABLE "student_profiles_student_profiles" (
  "student_profiles_interests" Interests,
  "student_profiles_academic_field" AcademicField,
  PRIMARY KEY ("student_profiles_interests", "student_profiles_academic_field")
);

ALTER TABLE "student_profiles_student_profiles" ADD FOREIGN KEY ("student_profiles_interests") REFERENCES "student_profiles" ("interests") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "student_profiles_student_profiles" ADD FOREIGN KEY ("student_profiles_academic_field") REFERENCES "student_profiles" ("academic_field") DEFERRABLE INITIALLY IMMEDIATE;
