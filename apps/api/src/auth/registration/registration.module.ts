import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { RegistrationController } from "./registration.controller.js";
import { RegistrationService } from "./registration.service.js";

@Module({
  imports: [PrismaModule],
  controllers: [RegistrationController],
  providers: [RegistrationService],
  exports: [RegistrationService],
})

export class RegistrationModule { }
