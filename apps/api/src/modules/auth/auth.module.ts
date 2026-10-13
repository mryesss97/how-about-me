import { Module } from "@nestjs/common";
import { MeController } from "./me.controller";
import { MeRepository } from "./me.repository";

@Module({ controllers: [MeController], providers: [MeRepository] })
export class AuthModule {}
