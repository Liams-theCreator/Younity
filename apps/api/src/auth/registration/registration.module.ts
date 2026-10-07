import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { RegistrationController } from "./registration.controller.js";
import { RegistrationService } from "./registration.service.js";
import { PasswordService } from './password/password.service';

@Module({
  imports: [PrismaModule],
  controllers: [RegistrationController],
  providers: [RegistrationService, PasswordService],
  exports: [RegistrationService],
})

export class RegistrationModule { }
