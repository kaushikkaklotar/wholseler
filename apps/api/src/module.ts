import { Controller, Get, Inject, Module } from "@nestjs/common";
import { Database, DatabaseModule } from "./database";
import { AuthModule, developmentAuth } from "./auth";
import { BillingModule } from "./billing";
import { CatalogModule } from "./catalog";
import { SourcingModule } from "./sourcing";
import { TeamModule } from "./team";
import { ReportingModule } from "./reporting";
import { PlatformModule } from "./platform";
import { CommunicationModule } from "./communication";
import { MediaModule } from "./media";
import { MarketplaceModule } from "./marketplace";
import { SubscriptionModule } from "./subscriptions";
import { ReservationModule } from "./reservations";
import { StockImportModule } from "./stock-import";
import { OperationsModule } from "./operations";
import { DeliveryModule } from "./notification-delivery";
@Controller("v1")
class SystemController {
  constructor(@Inject(Database) private readonly db: Database) {}
  @Get("health") async health() {
    await this.db.$queryRaw`SELECT 1`;
    return { status: "ok" };
  }
  @Get("config") async config() {
    const development = developmentAuth();
    return {
      development,
      accounts: development
        ? await this.db.user.findMany({
            where: { isSample: true, disabled: false },
            select: { name: true, phone: true, role: true },
            orderBy: { role: "asc" },
          })
        : [],
    };
  }
}
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    CatalogModule,
    BillingModule,
    SourcingModule,
    TeamModule,
    ReportingModule,
    PlatformModule,
    CommunicationModule,
    MediaModule,
    MarketplaceModule,
    SubscriptionModule,
    ReservationModule,
    StockImportModule,
    OperationsModule,
    DeliveryModule,
  ],
  controllers: [SystemController],
})
export class AppModule {}
