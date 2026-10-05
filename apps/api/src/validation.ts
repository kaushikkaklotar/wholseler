import { BadRequestException } from "@nestjs/common";
import type { z } from "zod";
export function parse<T extends z.ZodType>(
  schema: T,
  value: unknown,
): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException({
      message: result.error.issues
        .map(
          (i) =>
            `${i.path.join(".") ? i.path.join(".") + ": " : ""}${i.message}`,
        )
        .join("; "),
    });
  return result.data;
}
export function must<T>(
  value: T | null | undefined,
  message = "Record not found",
): T {
  if (value === null || value === undefined)
    throw new BadRequestException(message);
  return value;
}
