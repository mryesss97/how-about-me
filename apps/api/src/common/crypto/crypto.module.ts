import { Global, Module } from "@nestjs/common";
import { CryptoService } from "./crypto.service";

/** Global so `ThreadsTokenStore` (T-038) and the rewrap CLI share one validated key map. */
@Global()
@Module({ providers: [CryptoService], exports: [CryptoService] })
export class CryptoModule {}
