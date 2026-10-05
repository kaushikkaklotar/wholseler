import {
  Global,
  Injectable,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";
import { setTimeout } from "node:timers/promises";

@Injectable()
export class Database
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
  async serial<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await this.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10000,
          timeout: 20000,
        });
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== "P2034" ||
          attempt === 3
        )
          throw error;
        await setTimeout(40 * (attempt + 1) + Math.random() * 50);
      }
    }
    throw new Error("Transaction retry limit exceeded");
  }
}
@Global()
@Module({ providers: [Database], exports: [Database] })
export class DatabaseModule {}
export async function audit(
  tx: Prisma.TransactionClient,
  actorId: string,
  businessId: string | null,
  action: string,
  entityId: string,
  detail: string,
) {
  await tx.auditLog.create({
    data: { actorId, businessId, action, entityId, detail },
  });
}
export async function notify(
  tx: Prisma.TransactionClient,
  businessId: string | null,
  userId: string | null,
  title: string,
  body: string,
  href: string,
) {
  await tx.notification.create({
    data: { businessId, userId, title, body, href, readBy: [] },
  });
}
