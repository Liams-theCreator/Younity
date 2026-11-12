import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { RegistrationController } from "./registration.controller.js";
import { RegistrationService } from "./registration.service.js";
import { EmailVerificationModule } from "../email-verification/email-verification.module.js";

@Module({
  imports: [PrismaModule, EmailVerificationModule],
  controllers: [RegistrationController],
  providers: [RegistrationService],
  exports: [RegistrationService],
})

export class RegistrationModule { }
