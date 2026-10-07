import { NextResponse } from "next/server";
import { rejectUnlessAdmin } from "@/lib/auth/api-guard";
import { sendMail } from "@/lib/email/mailer";

export async function GET(req: Request) {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const to = searchParams.get("to");

  if (!to) {
    return NextResponse.json({ error: "Pass ?to=email@example.com" }, { status: 400 });
  }

  try {
    await sendMail({
      to,
      subject: "Pronuvia – Test Email",
      html: "<p>This is a test email from Pronuvia. If you received this, SendGrid is working correctly.</p>",
    });
    return NextResponse.json({ success: true, message: `Email sent to ${to}` });
  } catch (err: unknown) {
    const error = err as { message?: string; response?: { body?: unknown; statusCode?: number } };
    return NextResponse.json({
      success: false,
      error: error?.message,
      statusCode: error?.response?.statusCode,
      body: error?.response?.body,
    }, { status: 500 });
  }
}
