import { prisma } from "@/lib/prisma";

type CreateStaffInput = {
  ownerId: string;
  wholesalerId: string;
  name: string;
  phone: string;
  designation: string;
};

export async function createStaffWithSubscriptionLimit(input: CreateStaffInput) {
  const wholesaler = await prisma.wholesaler.findFirst({
    where: {
      id: input.wholesalerId,
      ownerId: input.ownerId
    },
    include: {
      subscriptionPlan: true,
      staff: {
        where: {
          status: {
            in: ["ACTIVE", "INVITED"]
          }
        }
      }
    }
  });

  if (!wholesaler) {
    throw new Error("Wholesaler not found or owner access denied.");
  }

  if (wholesaler.staff.length >= wholesaler.subscriptionPlan.staffLimit) {
    throw new Error("Staff limit reached for the current subscription plan.");
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name,
        phone: input.phone,
        role: "WHOLESALER_STAFF"
      }
    });

    const staff = await tx.wholesalerStaff.create({
      data: {
        userId: user.id,
        wholesalerId: input.wholesalerId,
        designation: input.designation,
        status: "INVITED"
      }
    });

    const defaultPermissions = [
      ["DASHBOARD", "VIEW"],
      ["PRODUCTS", "VIEW"],
      ["INVENTORY", "VIEW"]
    ] as const;

    await tx.staffPermission.createMany({
      data: defaultPermissions.map(([module, action]) => ({
        staffId: staff.id,
        module,
        action,
        allowed: true
      }))
    });

    return staff;
  });
}
