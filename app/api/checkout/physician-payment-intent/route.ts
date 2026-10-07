import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/server";
import { getSession } from "@/lib/auth/session";
import { Role } from "@/generated/prisma/enums";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== Role.PHYSICIAN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { amountInCents } = (await req.json()) as { amountInCents: number };

  if (!amountInCents || amountInCents < 50) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount:   amountInCents,
    currency: "usd",
    payment_method_types: ["card"],
    metadata: { physicianId: session.userId },
  });

  return NextResponse.json({ clientSecret: paymentIntent.client_secret });
}
