import { sendMail } from "@/lib/email/mailer";
import { doctorRegistrationEmail } from "@/lib/email/templates";

/**
 * Sends the registration confirmation email to a newly created doctor.
 * Awaited in the server action (non-blocking for user — wrapping try/catch keeps registration safe).
 * All failures are logged to console for debugging.
 */
export async function sendDoctorRegistrationEmail(opts: {
  to:        string;
  firstName: string;
  lastName:  string;
}): Promise<void> {
  try {
    const { subject, html } = doctorRegistrationEmail({
      firstName: opts.firstName,
      lastName:  opts.lastName,
    });

    console.log("[email] Sending registration confirmation to", opts.to);
    await sendMail({ to: opts.to, subject, html });
    console.log("[email] Registration confirmation sent to", opts.to);
  } catch (err) {
    console.error("[email] doctorRegistrationEmail FAILED for", opts.to, err);
  }
}
