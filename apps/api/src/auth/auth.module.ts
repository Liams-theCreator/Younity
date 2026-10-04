import { Module } from "@nestjs/common";
import { RegistrationModule } from "./registration/registration.module.js";

@Module({
  imports: [RegistrationModule],
})

export class AuthModule { }
