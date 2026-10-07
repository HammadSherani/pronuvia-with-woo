"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { ShippingMethod } from "@/generated/prisma/enums";

export type ShippingRateActionState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
} | undefined;

const ShippingRateSchema = z.object({
  continent:   z.string().min(1, "Continent is required"),
  country:     z.string().length(2, "Country code must be 2 characters"),
  countryName: z.string().min(1, "Country name is required"),
  states:      z.array(z.string()).default([]),
  stateNames:  z.array(z.string()).default([]),
  method:      z.nativeEnum(ShippingMethod),
  cost:        z.number().min(0).optional().default(0),
  isActive:    z.boolean().optional().default(true),
});

function revalidate() {
  revalidatePath("/admin/shipping-rates");
}

// Methods with a real customer-facing price — LOCAL_PICKUP and FREE are always $0.
const PRICED_METHODS: ShippingMethod[] = [ShippingMethod.FLAT, ShippingMethod.FEDEX_2DAY];

/** Check if a duplicate rule already exists (same country + same states set + same method). */
async function findDuplicate(
  country: string,
  states: string[],
  method: ShippingMethod,
  excludeId?: string,
) {
  const candidates = await prisma.shippingRate.findMany({
    where: { country, method },
    select: { id: true, states: true },
  });

  const sortedNew = [...states].sort().join(",");

  return candidates.find((c) => {
    if (excludeId && c.id === excludeId) return false;
    const sortedExisting = [...c.states].sort().join(",");
    return sortedExisting === sortedNew;
  });
}

export async function listShippingRates(filters?: {
  continent?: string;
  country?: string;
  method?: string;
}) {
  await requireAdmin();

  const where: Record<string, unknown> = {};
  if (filters?.continent) where.continent = filters.continent;
  if (filters?.country)   where.countryName = { contains: filters.country, mode: "insensitive" };
  if (filters?.method && Object.values(ShippingMethod).includes(filters.method as ShippingMethod)) {
    where.method = filters.method as ShippingMethod;
  }

  return prisma.shippingRate.findMany({
    where,
    orderBy: [{ continent: "asc" }, { countryName: "asc" }, { method: "asc" }],
  });
}

export async function createShippingRate(
  _state: ShippingRateActionState,
  formData: FormData,
): Promise<ShippingRateActionState> {
  await requireAdmin();

  const method = formData.get("method") as string;

  let states: string[] = [];
  let stateNames: string[] = [];
  try {
    states     = JSON.parse((formData.get("states")     as string) || "[]");
    stateNames = JSON.parse((formData.get("stateNames") as string) || "[]");
  } catch { /* ignore */ }

  const raw = {
    continent:   formData.get("continent")   as string,
    country:     formData.get("country")     as string,
    countryName: formData.get("countryName") as string,
    states,
    stateNames,
    method,
    cost:        PRICED_METHODS.includes(method as ShippingMethod) ? parseFloat((formData.get("cost") as string) || "0") : 0,
    isActive:    true,
  };

  const validated = ShippingRateSchema.safeParse(raw);
  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors as Record<string, string[]> };
  }

  const { continent, country, countryName, method: m, cost } = validated.data;

  if (PRICED_METHODS.includes(m) && (!cost || cost <= 0)) {
    return { errors: { cost: [`Shipping cost is required for ${m === ShippingMethod.FLAT ? "Flat Shipping" : "FedEx 2Day"}`] } };
  }

  const duplicate = await findDuplicate(country, states, m as ShippingMethod);
  if (duplicate) {
    const scope = states.length ? `${stateNames.join(", ")}` : countryName;
    return { message: `A shipping rule already exists for ${scope} with ${m}. Edit the existing rule instead.` };
  }

  await prisma.shippingRate.create({
    data: { continent, country, countryName, states, stateNames, method: m, cost, isActive: true },
  });

  revalidate();
  return { success: true, message: "Shipping rule created successfully." };
}

export async function updateShippingRate(
  id: string,
  _state: ShippingRateActionState,
  formData: FormData,
): Promise<ShippingRateActionState> {
  await requireAdmin();

  const method = formData.get("method") as string;

  let states: string[] = [];
  let stateNames: string[] = [];
  try {
    states     = JSON.parse((formData.get("states")     as string) || "[]");
    stateNames = JSON.parse((formData.get("stateNames") as string) || "[]");
  } catch { /* ignore */ }

  const raw = {
    continent:   formData.get("continent")   as string,
    country:     formData.get("country")     as string,
    countryName: formData.get("countryName") as string,
    states,
    stateNames,
    method,
    cost:        PRICED_METHODS.includes(method as ShippingMethod) ? parseFloat((formData.get("cost") as string) || "0") : 0,
    isActive:    formData.get("isActive") === "true",
  };

  const validated = ShippingRateSchema.safeParse(raw);
  if (!validated.success) {
    return { errors: z.flattenError(validated.error).fieldErrors as Record<string, string[]> };
  }

  const { continent, country, countryName, method: m, cost, isActive } = validated.data;

  if (PRICED_METHODS.includes(m) && (!cost || cost <= 0)) {
    return { errors: { cost: [`Shipping cost is required for ${m === ShippingMethod.FLAT ? "Flat Shipping" : "FedEx 2Day"}`] } };
  }

  const duplicate = await findDuplicate(country, states, m as ShippingMethod, id);
  if (duplicate) {
    const scope = states.length ? stateNames.join(", ") : countryName;
    return { message: `A shipping rule already exists for ${scope} with ${m}.` };
  }

  await prisma.shippingRate.update({
    where: { id },
    data:  { continent, country, countryName, states, stateNames, method: m, cost, isActive },
  });

  revalidate();
  return { success: true, message: "Shipping rule updated successfully." };
}

export async function deleteShippingRate(id: string): Promise<ShippingRateActionState> {
  await requireAdmin();

  const rule = await prisma.shippingRate.findUnique({ where: { id } });
  if (!rule) return { message: "Shipping rule not found." };

  await prisma.shippingRate.delete({ where: { id } });
  revalidate();
  return { success: true, message: "Shipping rule deleted." };
}

export async function toggleShippingRate(id: string): Promise<ShippingRateActionState> {
  await requireAdmin();

  const rule = await prisma.shippingRate.findUnique({ where: { id } });
  if (!rule) return { message: "Shipping rule not found." };

  await prisma.shippingRate.update({
    where: { id },
    data:  { isActive: !rule.isActive },
  });

  revalidate();
  return { success: true, message: rule.isActive ? "Rule disabled." : "Rule enabled." };
}
