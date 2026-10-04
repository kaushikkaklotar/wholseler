"use server";

import { revalidatePath } from "next/cache";

import { requireOwnerSession } from "@/lib/auth";
import { createStaffWithSubscriptionLimit } from "@/lib/staff-service";

export type StaffActionState = {
  message: string;
  ok: boolean;
};

export async function createStaffAction(
  _previousState: StaffActionState,
  formData: FormData
): Promise<StaffActionState> {
  const session = await requireOwnerSession();

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const designation = String(formData.get("designation") ?? "").trim();
  const wholesalerId = String(formData.get("wholesalerId") ?? "").trim();

  if (!name || !phone || !designation || !wholesalerId) {
    return {
      ok: false,
      message: "Name, phone, designation and wholesaler are required."
    };
  }

  try {
    await createStaffWithSubscriptionLimit({
      ownerId: session.id,
      wholesalerId,
      name,
      phone,
      designation
    });
    revalidatePath("/dashboard/staff");
    return {
      ok: true,
      message: "Staff invitation created."
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Staff could not be created."
    };
  }
}
