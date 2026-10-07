import { formatDateLong } from "@/lib/utils/timezone";

const getAppUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const C = {
  ink:        "#0B1220",   // website --color-ink  (footer, dark surfaces)
  navy:       "#1b3b6f",   // website --color-ion  (primary buttons, headings)
  teal:       "#3DBFA4",   // brand teal           (links, accents, borders)
  lightBlue:  "#5bb8d4",   // website --pronuvia-blue
  body:       "#f3f4f6",   // email body background
  card:       "#ffffff",
  surface:    "#f9fafb",   // info boxes
  border:     "#e5e7eb",
  muted:      "#6b7280",
  dimmed:     "#9ca3af",
  text:       "#111827",   // primary text
  textSoft:   "#374151",   // body text
};

const base = (content: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pronuvia</title>
</head>
<body style="margin:0;padding:0;background:${C.body};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.body};padding:24px 16px 40px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Logo / Brand -->
          <tr>
            <td align="center" style="padding-bottom:24px;padding-top:0;">
              <img src="cid:pronuvia-logo" alt="Pronuvia" width="160" height="auto" style="display:block;border:0;max-width:160px;" />
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:${C.card};border-radius:16px;padding:40px 40px 32px;box-shadow:0 1px 6px rgba(0,0,0,0.07);">
              ${content}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// Shared helpers
const btn = (href: string, label: string) =>
  `<div style="text-align:center;margin:28px 0;">
    <a href="${href}" style="display:inline-block;background:${C.navy};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">
      ${label}
    </a>
  </div>`;

const sectionLabel = (text: string) =>
  `<p style="margin:24px 0 6px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${C.teal};">${text}</p>`;

const infoBox = (inner: string) =>
  `<div style="background:${C.surface};border:1px solid ${C.border};border-radius:10px;padding:16px 20px;margin-bottom:24px;">${inner}</div>`;

const addrLabel = (text: string) =>
  `<p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${C.navy};">${text}</p>`;

// ─────────────────────────────────────────────
// Password setup email (new accounts — sales rep or physician)
// ─────────────────────────────────────────────
export function passwordSetupEmail(opts: {
  firstName: string;
  email: string;
  resetToken: string;
  role: "salesRep" | "physician";
}) {
  const resetLink = `${getAppUrl()}/reset-password/${opts.resetToken}`;
  const roleLabel = opts.role === "salesRep" ? "Medical Representative" : "Partnering Physician";
  const subject = "Welcome to Pronuvia — Set Your Password";
  const html = base(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${C.ink};">
      Welcome, ${opts.firstName}!
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:${C.muted};line-height:1.6;">
      Your Pronuvia ${roleLabel} account has been created.
      Click the button below to set your password and activate your account.
    </p>

    ${infoBox(`
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:${C.dimmed};text-transform:uppercase;letter-spacing:0.06em;">Your Login Email</p>
      <p style="margin:8px 0 0;font-size:14px;font-weight:600;color:${C.text};">${opts.email}</p>
    `)}

    ${btn(resetLink, "Set My Password")}

    <p style="margin:0 0 12px;font-size:13px;color:${C.dimmed};line-height:1.6;">
      This link will expire in <strong style="color:${C.muted};">72 hours</strong>.
      If you did not expect this email, please ignore it.
    </p>
    <p style="margin:0;font-size:11px;color:#d1d5db;word-break:break-all;">${resetLink}</p>
  `);
  return { subject, html };
}

// ─────────────────────────────────────────────
// Sales rep notification — doctor approved by admin
// ─────────────────────────────────────────────
export function salesRepDoctorApprovedEmail(opts: {
  doctorFirstName: string;
  doctorLastName:  string;
}) {
  const subject = `${opts.doctorFirstName} ${opts.doctorLastName} has been approved`;
  const html = base(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:${C.ink};">
      Physician Approved
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:${C.textSoft};line-height:1.7;">
      We are glad to inform you that
      <strong style="color:${C.text};"> ${opts.doctorFirstName} ${opts.doctorLastName}</strong>
      has been confirmed and their account is now active.
    </p>
    <div style="background:#f0fdf9;border:1px solid #a7f3d0;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;font-weight:700;color:#065f46;">&#10003; Account Confirmed</p>
      <p style="margin:4px 0 0;font-size:13px;color:#047857;line-height:1.5;">
        ${opts.doctorFirstName} ${opts.doctorLastName} can now log in and place orders through the Pronuvia portal.
      </p>
    </div>
    <p style="margin:0;font-size:14px;color:${C.muted};line-height:1.6;">
      Thank you for bringing them on board. Any orders they place will be reflected in your commission.
    </p>
  `);
  return { subject, html };
}

// ─────────────────────────────────────────────
// Sales rep notification — doctor signed up
// ─────────────────────────────────────────────
export function salesRepDoctorSignupEmail(opts: {
  doctorFirstName: string;
  doctorLastName:  string;
}) {
  const subject = `${opts.doctorFirstName} ${opts.doctorLastName} has signed up`;
  const html = base(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:${C.ink};">
      New Physician Sign-Up
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:${C.textSoft};line-height:1.7;">
      We are glad to inform you that
      <strong style="color:${C.text};">${opts.doctorFirstName} ${opts.doctorLastName}</strong>
      signed up for you.
    </p>
    <p style="margin:0;font-size:14px;color:${C.muted};line-height:1.6;">
      Their application is now pending admin approval. You will be notified once it is reviewed.
    </p>
  `);
  return { subject, html };
}

// ─────────────────────────────────────────────
// Physician approval welcome email (detailed onboarding)
// ─────────────────────────────────────────────
export function physicianApprovalEmail(opts: {
  firstName: string;
  lastName:  string;
  email:     string;
  loginId:   string;
  resetToken: string;
  /** True when the physician (or whoever created the account) explicitly set
   * a password at sign-up — drives which Login Info password line renders. */
  hasCustomPassword: boolean;
}) {
  const resetLink = `${getAppUrl()}/reset-password/${opts.resetToken}`;
  const subject   = `PRONUVIA WELCOME ABOARD – Dr. ${opts.firstName} ${opts.lastName}`;

  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:7px 0;font-size:13px;color:${C.muted};white-space:nowrap;vertical-align:top;width:160px;">${label}</td>
      <td style="padding:7px 0 7px 12px;font-size:13px;color:${C.text};font-weight:600;word-break:break-all;">${value}</td>
    </tr>`;

  // Option A: a real password was already chosen at sign-up — no reset needed.
  // Option B (legacy accounts only): no known password — point to the reset flow.
  const passwordRow = opts.hasCustomPassword
    ? row("Password:", "Use the password you created during sign-up")
    : row("Password:", `Click <a href="${resetLink}" style="color:${C.teal};font-weight:600;">&ldquo;Forgot Your Password?&rdquo;</a> to set your password`);

  const html = base(`
    <p style="margin:0 0 6px;font-size:15px;color:${C.text};line-height:1.6;">Dear ${opts.firstName} ${opts.lastName},</p>
    <p style="margin:0 0 18px;font-size:14px;color:${C.textSoft};line-height:1.7;">
      I am Jason from Pronuvia and am glad to welcome you as a participating physician for AIC Therapy.
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:${C.textSoft};line-height:1.7;">
      Your application to set up an account with us is now <strong style="color:${C.navy};">approved</strong>. Congratulations.
      I am certain that you are excited to try out our new ionic calcium therapy for your patients, and we are equally
      excited to come alongside to provide all the needed support. However, let's get all the required legal documentation
      taken care of first so that we can move forward with full steam.
    </p>

    ${sectionLabel("Login Info")}
    ${infoBox(`
      <table cellpadding="0" cellspacing="0" style="width:100%;">
        ${row("Website:", "www.pronuvia.com")}
        ${row("Username (Login ID):", opts.loginId)}
        ${row("Email:", opts.email)}
        ${passwordRow}
      </table>
    `)}
    ${!opts.hasCustomPassword ? btn(resetLink, "Set My Password") : ""}

    ${sectionLabel("AIC Calcium Resources")}
    <p style="margin:0 0 16px;font-size:14px;color:${C.textSoft};line-height:1.75;">
      AIC calcium is the world's first ionized calcium treatment that re-establishes calcium homeostasis
      by reversing cellular to systemic calcification, resulting in restored optimal cell signaling,
      reduced oxidative stress, and rejuvenated mitochondrial functions. AIC triggers our body's natural
      healing mechanisms to reverse many difficult chronic degenerative diseases that had no real hope.
      Please read through the attached resources below for your study and reference.
    </p>
    <div style="border:1px solid ${C.border};border-radius:10px;padding:16px 20px;margin-bottom:14px;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${C.text};">AIC for Calcium Signaling (Book)</p>
      <p style="margin:0;font-size:13px;color:${C.textSoft};line-height:1.65;">
        More technical information on AIC can be found from the book <em>"AIC for Calcium Signaling"</em>
        written by the inventor of AIC, Paul Lee.
      </p>
    </div>
    <div style="border:1px solid ${C.border};border-radius:10px;padding:16px 20px;margin-bottom:14px;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${C.text};">AIC Therapy Dosing Protocol</p>
      <p style="margin:0;font-size:13px;color:${C.textSoft};line-height:1.65;">
        The dosage protocol guideline provides participating physicians with suggestions on how Pronuvia's
        AIC-applied products can be utilized effectively in treating communicable and degenerative diseases.
        This dosing protocol is only for doctors.
      </p>
    </div>
    <div style="border:1px solid ${C.border};border-radius:10px;padding:16px 20px;margin-bottom:14px;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${C.text};">Introduction to AIC Therapy (Booklet)</p>
      <p style="margin:0;font-size:13px;color:${C.textSoft};line-height:1.65;">
        The booklet introduces the underlying technology of AIC and the principles behind the new and safe
        therapy based on AIC technology. This booklet can be shared with patients.
      </p>
    </div>
    <div style="border:1px solid ${C.border};border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${C.text};">AIC Brochure</p>
      <p style="margin:0;font-size:13px;color:${C.textSoft};line-height:1.65;">
        This simple brochure provides a good summary of AIC therapy.
      </p>
    </div>

    ${sectionLabel("B2B Order Process")}
    <p style="margin:0 0 10px;font-size:14px;color:${C.textSoft};line-height:1.7;">
      Your office needs to enter the order through our website after login at <strong>www.pronuvia.com</strong> (not www.AICtherapy.com).
    </p>
    <p style="margin:0 0 10px;font-size:14px;color:${C.textSoft};line-height:1.7;">
      After login, please go to <strong>"Account Manager"</strong> and click <strong>"Order Products"</strong> on the menu.
    </p>
    <p style="margin:0 0 10px;font-size:14px;color:${C.textSoft};line-height:1.7;">
      You can put the shipping address and credit card info of your patient if you want so that we can support the drop ship to your patient.
    </p>
    <p style="margin:0 0 10px;font-size:14px;color:${C.textSoft};line-height:1.7;">
      Please enter patient's email address when you order so that they can receive shipment tracking number.
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:${C.textSoft};line-height:1.7;">
      You will receive the order confirmation email automatically as cc.
    </p>

    ${sectionLabel("Agreement")}
    <p style="margin:0 0 24px;font-size:14px;color:${C.textSoft};line-height:1.7;">
      We attached the Terms and Conditions you agreed during the application process.
    </p>

    ${sectionLabel("Free Consultation")}
    <p style="margin:0 0 10px;font-size:14px;color:${C.textSoft};line-height:1.7;">
      To help new doctors get started, we provide a 30-minute personal free consultation. You and your staff or anyone
      in the practice who needs the basic introduction to AIC Therapy can join. During the call, we can answer any
      questions that you may have.
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:${C.textSoft};line-height:1.7;">
      You can book a free consultation at:<br/>
      <a href="https://www.aictherapy.com/book-a-consultation" style="color:${C.teal};">https://www.aictherapy.com/book-a-consultation</a>
    </p>

    ${sectionLabel("The Scope of Practice")}
    <p style="margin:0 0 24px;font-size:14px;color:${C.textSoft};line-height:1.7;">
      We ask approved doctors and health practitioners to limit the use of AIC (Anti-orbital Ionic Calcium) therapy
      within the legally allowed scope of the license in treating patients. For example, for nutritionists, AIC therapy
      can be utilized to treat ionic calcium deficiency, to restore calcium homeostasis, to boost the immune system,
      to balance the body pH, and for other general calcium-related health issues from a nutritional therapy point of view.
    </p>

    ${sectionLabel("Commission Payout")}
    <p style="margin:0 0 10px;font-size:14px;color:${C.textSoft};line-height:1.7;">
      We will send you 25% of the commission in the first week of each month. Please provide the information for one of
      the following payout options (we suggest ACH as it is safer and faster):
    </p>
    <p style="margin:0 0 4px;font-size:13px;color:${C.text};font-weight:600;">(1) ACH</p>
    <p style="margin:0 0 10px;font-size:13px;color:${C.textSoft};line-height:1.7;">Bank Name · Bank Routing Number · Account Number · Account Type (Checking or Savings) · Name on the Account</p>
    <p style="margin:0 0 4px;font-size:13px;color:${C.text};font-weight:600;">(2) Check</p>
    <p style="margin:0 0 10px;font-size:13px;color:${C.textSoft};line-height:1.7;">Provide name for "Payable to" and mailing address.</p>
    <p style="margin:0 0 4px;font-size:13px;color:${C.text};font-weight:600;">(3) Zelle, Venmo, or PayPal</p>
    <p style="margin:0 0 24px;font-size:13px;color:${C.textSoft};line-height:1.7;">
      Zelle: email or phone number · Venmo: username or email · PayPal: email address
    </p>

    ${sectionLabel("W-9 Form")}
    <p style="margin:0 0 10px;font-size:14px;color:${C.textSoft};line-height:1.7;">
      We sent an email via QuickBooks to you for W-9 now. Please fill out the W-9 form within 24 hours as the link
      will become inactive. The email subject is <em>"Fill out your W-9 tax info for Pronuvia, Inc."</em>
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:${C.textSoft};line-height:1.7;">
      Alternatively, you may fill out the attached W-9 form with your signature and send us back the scanned file.
    </p>

    ${sectionLabel("Website Content Policy for Pronuvia Products")}
    <p style="margin:0 0 10px;font-size:14px;color:${C.textSoft};line-height:1.7;">
      We suggest doctors market AIC as a therapy under a generic treatment name (e.g. AIC calcium therapy or ionic
      calcium therapy) instead of marketing branded products directly.
    </p>
    <p style="margin:0 0 4px;font-size:13px;color:${C.textSoft};line-height:1.7;">• Please do not list our company name (Pronuvia) and product information searchable on Google on your website.</p>
    <p style="margin:0 0 4px;font-size:13px;color:${C.textSoft};line-height:1.7;">• Please provide a doctor's phone number or email for consultations. All orders should be offline by phone.</p>
    <p style="margin:0 0 4px;font-size:13px;color:${C.textSoft};line-height:1.7;">• Recommended treatment names: "AIC Therapy," "AIC Ionic Calcium Treatment," "Ionic Calcium Treatment," "Calcium Ion Treatment."</p>
    <p style="margin:0 0 24px;font-size:14px;color:${C.textSoft};line-height:1.7;">
      Please note that the 30-min free consultation is a very important and useful session to understand our products.
    </p>

    <p style="margin:0 0 6px;font-size:14px;color:${C.textSoft};line-height:1.7;">
      If you have any questions, please contact us at <strong>800-568-2982</strong> or
      <a href="mailto:contact@pronuvia.com" style="color:${C.teal};">contact@pronuvia.com</a>.
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:${C.textSoft};line-height:1.7;">Thank you.<br/><br/>Sincerely,<br/><strong style="color:${C.text};">Jason Park</strong><br/>Pronuvia Physician Support</p>

    <div style="border-top:1px solid ${C.border};margin-top:24px;padding-top:20px;">
      <p style="margin:0 0 8px;font-size:10px;font-weight:700;color:${C.dimmed};letter-spacing:0.08em;text-transform:uppercase;">Disclaimer</p>
      <p style="margin:0 0 12px;font-size:11px;color:${C.dimmed};line-height:1.7;">
        Pronuvia thanks participating doctors, clinics, and health care practitioners for making AIC therapy available
        to consenting patients. Please note that Pronuvia hereby makes no medical claims to treat or cure any diseases.
        AIC products are registered as dietary supplements. AIC therapy is a nutritional therapy based on ionic calcium.
        Utilizing physiological reactions in treating diseases is solely at the discretion of participating physicians.
        Pronuvia distributes AIC applied products only through licensed physicians, clinics, and health care practitioners.
        Pronuvia, as a company, does not treat patients directly nor offer any health advice.
      </p>
      <p style="margin:0;font-size:11px;color:${C.dimmed};line-height:1.7;">
        The information in this email has not been evaluated by the Food &amp; Drug Administration or any other
        medical body. We do not aim to diagnose, treat, cure, or prevent any illness or disease. The information
        shared here is for educational purposes only. You must consult your doctor or healthcare professional
        before acting on any content, especially if you are pregnant, nursing, taking medication, or have a
        medical condition. This email is not intended to replace a one-on-one relationship with a qualified
        health care professional and is not intended as medical advice.
      </p>
    </div>
  `);
  return { subject, html };
}

// ─────────────────────────────────────────────
// Sales rep welcome email
// ─────────────────────────────────────────────
export function salesRepWelcomeEmail(opts: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}) {
  const subject = "Welcome to Pronuvia — Your Account is Ready";
  const html = base(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${C.ink};">
      Welcome, ${opts.firstName}!
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:${C.muted};line-height:1.6;">
      Your Pronuvia Medical Representative account has been created.
      You can now log in and start managing your partnering physicians.
    </p>
    ${infoBox(`
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:${C.dimmed};text-transform:uppercase;letter-spacing:0.06em;">Your Login Credentials</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
        <tr>
          <td style="padding:6px 0;font-size:13px;color:${C.muted};width:110px;">Email</td>
          <td style="padding:6px 0;font-size:13px;font-weight:600;color:${C.text};">${opts.email}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;color:${C.muted};">Password</td>
          <td style="padding:6px 0;font-size:13px;font-weight:600;color:${C.text};font-family:monospace;">${opts.password}</td>
        </tr>
      </table>
    `)}
    ${btn(`${getAppUrl()}/login`, "Log In to Your Account")}
    <p style="margin:0;font-size:13px;color:${C.dimmed};line-height:1.6;">
      For security, please change your password after your first login.
    </p>
  `);
  return { subject, html };
}

// ─────────────────────────────────────────────
// Physician welcome email (admin-created, auto-approved)
// ─────────────────────────────────────────────
export function physicianWelcomeEmail(opts: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  nameOfPractice?: string | null;
}) {
  const subject = "Welcome to Pronuvia — Your Physician Account is Ready";
  const html = base(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${C.ink};">
      Welcome, ${opts.firstName} ${opts.lastName}!
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:${C.muted};line-height:1.6;">
      Your Pronuvia Partnering Physician account has been created and
      <strong style="color:${C.navy};">approved</strong>.
      You can log in immediately and start placing orders.
    </p>

    ${opts.nameOfPractice ? `
    <p style="margin:-12px 0 24px;font-size:14px;color:${C.muted};">
      Practice: <strong style="color:${C.text};">${opts.nameOfPractice}</strong>
    </p>` : ""}

    ${infoBox(`
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:${C.dimmed};text-transform:uppercase;letter-spacing:0.06em;">Your Login Credentials</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
        <tr>
          <td style="padding:6px 0;font-size:13px;color:${C.muted};width:110px;">Email</td>
          <td style="padding:6px 0;font-size:13px;font-weight:600;color:${C.text};">${opts.email}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;color:${C.muted};">Password</td>
          <td style="padding:6px 0;font-size:13px;font-weight:600;color:${C.text};font-family:monospace;">${opts.password}</td>
        </tr>
      </table>
    `)}

    ${btn(`${getAppUrl()}/login`, "Log In to Your Account")}

    <p style="margin:0;font-size:13px;color:${C.dimmed};line-height:1.6;">
      For security, please change your password after your first login.
      If you have any questions, contact your sales representative or administrator.
    </p>
  `);
  return { subject, html };
}

// ─────────────────────────────────────────────
// Sales rep notification — new physician assigned to them
// ─────────────────────────────────────────────
export function salesRepPhysicianAssignedEmail(opts: {
  salesRepFirstName: string;
  physicianFirstName: string;
  physicianLastName: string;
  physicianEmail: string;
  nameOfPractice?: string | null;
}) {
  const subject = `Great news! ${opts.physicianFirstName} ${opts.physicianLastName} has joined through your referral`;
  const html = base(`
    <div style="display:inline-block;background:#f0fdf9;border:1px solid #a7f3d0;border-radius:8px;padding:6px 14px;margin-bottom:20px;">
      <span style="color:#047857;font-size:13px;font-weight:600;">&#10003; New Referral Added</span>
    </div>

    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${C.ink};">
      A doctor joined through your referral!
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:${C.muted};line-height:1.6;">
      Hi ${opts.salesRepFirstName}, great news!
      The administrator has added <strong style="color:${C.text};">${opts.physicianFirstName} ${opts.physicianLastName}</strong>
      to Pronuvia under your account. Their account is already active and approved.
    </p>

    ${infoBox(`
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:${C.dimmed};text-transform:uppercase;letter-spacing:0.06em;">Physician Details</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
        <tr>
          <td style="padding:6px 0;font-size:13px;color:${C.muted};width:130px;">Name</td>
          <td style="padding:6px 0;font-size:13px;font-weight:600;color:${C.text};">${opts.physicianFirstName} ${opts.physicianLastName}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;color:${C.muted};">Email</td>
          <td style="padding:6px 0;font-size:13px;font-weight:600;color:${C.text};">${opts.physicianEmail}</td>
        </tr>
        ${opts.nameOfPractice ? `
        <tr>
          <td style="padding:6px 0;font-size:13px;color:${C.muted};">Practice</td>
          <td style="padding:6px 0;font-size:13px;font-weight:600;color:${C.text};">${opts.nameOfPractice}</td>
        </tr>` : ""}
        <tr>
          <td style="padding:6px 0;font-size:13px;color:${C.muted};">Status</td>
          <td style="padding:6px 0;">
            <span style="background:#f0fdf9;color:#047857;font-size:12px;font-weight:600;padding:2px 10px;border-radius:20px;border:1px solid #a7f3d0;">
              Approved &amp; Active
            </span>
          </td>
        </tr>
      </table>
    `)}

    ${btn(`${getAppUrl()}/sales/physicians`, "View My Physicians")}

    <p style="margin:0;font-size:13px;color:${C.dimmed};line-height:1.6;">
      Any orders placed by this physician will count towards your commission.
      Log in to your dashboard to stay updated.
    </p>
  `);
  return { subject, html };
}

// ─────────────────────────────────────────────
// Order email helpers
// ─────────────────────────────────────────────
function recipientFirstName(d: { shippingAddress?: string | null; billingAddress?: string | null }): string | null {
  for (const raw of [d.shippingAddress, d.billingAddress]) {
    if (!raw) continue;
    try {
      const a = JSON.parse(raw);
      const name = [a.firstName, a.lastName].filter(Boolean).join(" ");
      if (name) return name;
    } catch { /* ignore */ }
  }
  return null;
}

type OrderItem = {
  title: string; variantSize?: string;
  quantity: number; unitPrice: number; lineTotal: number;
};

function orderItemsTable(items: OrderItem[]) {
  const rows = items.map((i) => `
    <tr>
      <td style="padding:10px 0;font-size:13px;color:${C.text};border-bottom:1px solid #f3f4f6;">
        ${i.title}${i.variantSize ? ` <span style="color:${C.muted};">(${i.variantSize})</span>` : ""}
      </td>
      <td style="padding:10px 0;font-size:13px;color:${C.muted};text-align:center;border-bottom:1px solid #f3f4f6;">${i.quantity}</td>
      <td style="padding:10px 0;font-size:13px;color:${C.muted};text-align:right;border-bottom:1px solid #f3f4f6;">$${i.unitPrice.toFixed(2)}</td>
      <td style="padding:10px 0;font-size:13px;font-weight:600;color:${C.text};text-align:right;border-bottom:1px solid #f3f4f6;">$${i.lineTotal.toFixed(2)}</td>
    </tr>`).join("");
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <thead><tr>
        <th style="padding:0 0 8px;font-size:11px;font-weight:600;color:${C.dimmed};text-transform:uppercase;letter-spacing:.06em;text-align:left;">Product</th>
        <th style="padding:0 0 8px;font-size:11px;font-weight:600;color:${C.dimmed};text-transform:uppercase;letter-spacing:.06em;text-align:center;">Qty</th>
        <th style="padding:0 0 8px;font-size:11px;font-weight:600;color:${C.dimmed};text-transform:uppercase;letter-spacing:.06em;text-align:right;">Unit</th>
        <th style="padding:0 0 8px;font-size:11px;font-weight:600;color:${C.dimmed};text-transform:uppercase;letter-spacing:.06em;text-align:right;">Total</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export type OrderEmailData = {
  orderNumber:        string;
  firstName:          string;
  total:              number;
  status:             string;
  items:              OrderItem[];
  trackingNumber?:    string | null;
  shippingCarrier?:   string | null;
  estimatedDelivery?: Date | null;
  isPatientEmail?:    boolean;
  shippingCost?:      number;
  // The option selected at checkout, e.g. "FedEx 2Day Shipping" — distinct
  // from shippingCarrier, which is only set once a label is actually bought.
  shippingMethod?:    string | null;
  couponCode?:        string | null;
  discountAmount?:    number;
  paymentMethod?:     string | null;
  billingAddress?:    string | null;
  shippingAddress?:   string | null;
  notes?:             string | null;
  orderDate?:         Date;
  email?:             string | null;
  customerPhone?:     string | null;
  // Fallback greeting name when no shipping/billing name is present (e.g.
  // shipped straight to the doctor's own practice address with no patient
  // name on file) — renders as "Hello Dr. [First] [Last]," instead of a
  // bare "Hello,".
  doctorFirstName?:   string | null;
  doctorLastName?:    string | null;
};

function renderAddr(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const a = JSON.parse(raw);
    return [
      [a.firstName, a.lastName].filter(Boolean).join(" "),
      a.address1, a.address2,
      [a.city, a.state, a.zip].filter(Boolean).join(", "),
      a.country, a.phone,
    ].filter(Boolean).join("<br/>");
  } catch {
    return raw.replace(/\n/g, "<br/>");
  }
}

function addrWithContact(raw: string | null | undefined, email?: string | null, phone?: string | null): string {
  const addrHtml = renderAddr(raw);
  let extra = "";
  if (phone) extra += `<br/><span style="color:${C.muted};">Phone:&nbsp;</span>${phone}`;
  if (email) extra += `<br/><span style="color:${C.muted};">Email:&nbsp;</span>${email}`;
  return addrHtml + extra;
}

const orderTableHeader = `
  <tr style="background:${C.surface};">
    <th style="padding:10px 12px;font-size:11px;font-weight:700;color:${C.muted};text-transform:uppercase;letter-spacing:.06em;text-align:left;border-bottom:1px solid ${C.border};">Product</th>
    <th style="padding:10px 12px;font-size:11px;font-weight:700;color:${C.muted};text-transform:uppercase;letter-spacing:.06em;text-align:center;border-bottom:1px solid ${C.border};">Qty</th>
    <th style="padding:10px 12px;font-size:11px;font-weight:700;color:${C.muted};text-transform:uppercase;letter-spacing:.06em;text-align:right;border-bottom:1px solid ${C.border};">Price</th>
  </tr>`;

// ─────────────────────────────────────────────
// Order confirmation email
// ─────────────────────────────────────────────
export function orderConfirmationEmail(d: OrderEmailData) {
  // Greeting name fallback chain: shipping/billing name on file, then the
  // doctor's own name (e.g. shipped straight to the practice with no patient
  // name entered), then a plain "Hello," / "Hi there," — never a name-less
  // "Hello ," or "Hi ,".
  const addressName = recipientFirstName(d);
  const doctorName  = d.doctorFirstName
    ? `Dr. ${d.doctorFirstName}${d.doctorLastName ? ` ${d.doctorLastName}` : ""}`
    : null;
  const name = addressName || doctorName;
  const greeting = d.isPatientEmail
    ? (name ? `Hello ${name},` : "Hello,")
    : (d.firstName ? `Hi ${d.firstName},` : "Hi there,");
  const dateStr  = formatDateLong(d.orderDate ?? new Date());
  const orderStatusLink = `${getAppUrl()}/login`;
  const subtotal  = d.items.reduce((s, i) => s + i.lineTotal, 0);
  const shipping  = d.shippingCost ?? 0;
  const discount  = d.discountAmount ?? 0;

  const payLabel = (() => {
    const pm = d.paymentMethod;
    if (!pm) return "—";
    if (pm === "CARD")   return "Credit card / debit card";
    if (pm === "WALLET") return "Wallet";
    return pm;
  })();

  const itemRows = d.items.map(i => `
    <tr>
      <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};border-bottom:1px solid #f3f4f6;">
        ${i.title}${i.variantSize ? `<br/><span style="font-size:12px;color:${C.muted};">Volume: ${i.variantSize}</span>` : ""}
      </td>
      <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:center;border-bottom:1px solid #f3f4f6;">${i.quantity}</td>
      <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:right;border-bottom:1px solid #f3f4f6;">$${i.lineTotal.toFixed(2)}</td>
    </tr>`).join("");

  return {
    subject: `Thank you for your order #${d.orderNumber}`,
    html: base(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:${C.ink};">Thank you for your order</h1>
      <p style="margin:0 0 4px;font-size:14px;color:${C.textSoft};font-weight:500;">${greeting}</p>
      <p style="margin:0 0 24px;font-size:13px;color:${C.muted};line-height:1.6;">
        We've received your order <strong style="color:${C.navy};">#${d.orderNumber}</strong>, and it is now being processed.
      </p>

      <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:${C.navy};">[Order #${d.orderNumber}] (${dateStr})</p>

      <table width="100%" cellpadding="0" cellspacing="0"
        style="border:1px solid ${C.border};border-radius:10px;overflow:hidden;margin-bottom:24px;border-collapse:collapse;">
        <thead>${orderTableHeader}</thead>
        <tbody>
          ${itemRows}
          <tr>
            <td style="padding:10px 12px;font-size:13px;font-weight:600;color:${C.textSoft};border-top:1px solid ${C.border};">Subtotal:</td>
            <td style="border-top:1px solid ${C.border};"></td>
            <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:right;border-top:1px solid ${C.border};">$${subtotal.toFixed(2)}</td>
          </tr>
          ${discount > 0 ? `
          <tr>
            <td style="padding:10px 12px;font-size:13px;font-weight:600;color:#16a34a;border-top:1px solid #f3f4f6;">Coupon${d.couponCode ? ` (${d.couponCode})` : ""}:</td>
            <td style="border-top:1px solid #f3f4f6;"></td>
            <td style="padding:10px 12px;font-size:13px;color:#16a34a;text-align:right;border-top:1px solid #f3f4f6;">−$${discount.toFixed(2)}</td>
          </tr>` : ""}
          ${shipping > 0 ? `
          <tr>
            <td style="padding:10px 12px;font-size:13px;font-weight:600;color:${C.textSoft};border-top:1px solid #f3f4f6;">${d.shippingMethod ? d.shippingMethod : "Shipping"}:</td>
            <td style="border-top:1px solid #f3f4f6;"></td>
            <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:right;border-top:1px solid #f3f4f6;">$${shipping.toFixed(2)}</td>
          </tr>` : ""}
          <tr>
            <td style="padding:10px 12px;font-size:13px;font-weight:600;color:${C.textSoft};border-top:1px solid #f3f4f6;">Payment method:</td>
            <td style="border-top:1px solid #f3f4f6;"></td>
            <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:right;border-top:1px solid #f3f4f6;">${payLabel}</td>
          </tr>
          <tr style="background:${C.surface};">
            <td style="padding:10px 12px;font-size:13px;font-weight:700;color:${C.text};border-top:1px solid ${C.border};">Total:</td>
            <td style="border-top:1px solid ${C.border};"></td>
            <td style="padding:10px 12px;font-size:13px;font-weight:700;color:${C.text};text-align:right;border-top:1px solid ${C.border};">$${d.total.toFixed(2)}</td>
          </tr>
          ${d.notes ? `
          <tr>
            <td style="padding:10px 12px;font-size:13px;font-weight:600;color:${C.textSoft};border-top:1px solid #f3f4f6;">Note:</td>
            <td style="border-top:1px solid #f3f4f6;"></td>
            <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:right;border-top:1px solid #f3f4f6;">${d.notes}</td>
          </tr>` : ""}
        </tbody>
      </table>

      ${(d.billingAddress || d.shippingAddress) ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          ${d.billingAddress ? `
          <td width="50%" style="vertical-align:top;padding-right:10px;">
            ${addrLabel("Billing address")}
            <div style="border:1px solid ${C.border};border-radius:8px;padding:12px 14px;">
              <p style="margin:0;font-size:13px;color:${C.textSoft};line-height:1.7;">${addrWithContact(d.billingAddress, d.email, d.customerPhone)}</p>
            </div>
          </td>` : "<td width='50%'></td>"}
          ${d.shippingAddress ? `
          <td width="50%" style="vertical-align:top;padding-left:10px;">
            ${addrLabel("Shipping address")}
            <div style="border:1px solid ${C.border};border-radius:8px;padding:12px 14px;">
              <p style="margin:0;font-size:13px;color:${C.textSoft};line-height:1.7;">${addrWithContact(d.shippingAddress, d.email, d.customerPhone)}</p>
            </div>
          </td>` : "<td width='50%'></td>"}
        </tr>
      </table>` : ""}

      ${sectionLabel("Shipping & Tracking")}
      ${infoBox(
        d.trackingNumber
          ? `<p style="margin:0 0 4px;font-size:13px;color:${C.textSoft};line-height:1.6;">
               <strong style="color:${C.text};">Carrier:</strong> ${d.shippingCarrier ?? "—"}
             </p>
             <p style="margin:0 0 4px;font-size:13px;color:${C.textSoft};line-height:1.6;">
               <strong style="color:${C.text};">Tracking number:</strong> ${d.trackingNumber}
             </p>
             ${d.estimatedDelivery ? `<p style="margin:0;font-size:13px;color:${C.textSoft};line-height:1.6;">
               <strong style="color:${C.text};">Estimated delivery:</strong> ${formatDateLong(d.estimatedDelivery)}
             </p>` : ""}`
          : `<p style="margin:0;font-size:13px;color:${C.muted};line-height:1.6;">
               Your order is being prepared. Tracking information will be added here and emailed to you as soon as it ships.
             </p>`
      )}

      ${btn(orderStatusLink, "View Order Status")}

      ${sectionLabel("Need Help?")}
      <p style="margin:0 0 24px;font-size:13px;color:${C.textSoft};line-height:1.7;">
        Our support team is here for any questions about this order.<br/>
        <strong style="color:${C.text};">Phone:</strong> 800-568-2982 &nbsp;·&nbsp;
        <strong style="color:${C.text};">Email:</strong>
        <a href="mailto:contact@pronuvia.com" style="color:${C.teal};">contact@pronuvia.com</a>
      </p>

      <div style="border-top:1px solid ${C.border};margin-top:8px;padding-top:20px;text-align:center;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${C.text};">Pronuvia, Inc.</p>
        <p style="margin:0 0 12px;font-size:12px;color:${C.muted};">Thank you for choosing Pronuvia AIC Therapy.</p>
        <p style="margin:0;font-size:11px;color:${C.dimmed};">
          This is an automated message regarding order #${d.orderNumber}. Please do not reply directly to this email —
          contact us at <a href="mailto:contact@pronuvia.com" style="color:${C.dimmed};">contact@pronuvia.com</a> instead.
        </p>
      </div>
    `),
  };
}

// ─────────────────────────────────────────────
// New-order notification (internal — sent to sales1.pronuvia@gmail.com)
// ─────────────────────────────────────────────
export function newOrderNotificationEmail(opts: {
  orderNumber:     string;
  orderedBy:       string;
  orderDate:       Date;
  items:           OrderItem[];
  subtotal:        number;
  shippingCost:    number;
  couponCode?:     string | null;
  discountAmount?: number;
  paymentMethod:   string | null;
  total:           number;
  billingAddress?:  string | null;
  shippingAddress?: string | null;
  contactEmail?:    string | null;
  contactPhone?:    string | null;
}) {
  const dateStr = formatDateLong(opts.orderDate);

  const payLabel = (() => {
    const pm = opts.paymentMethod;
    if (!pm) return "—";
    if (pm === "CARD")   return "Credit / Debit Card";
    if (pm === "WALLET") return "Wallet";
    return pm;
  })();

  const itemRows = opts.items.map(i => `
    <tr>
      <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};border-bottom:1px solid #f3f4f6;">
        ${i.title}${i.variantSize ? ` (${i.variantSize})` : ""}
      </td>
      <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:center;border-bottom:1px solid #f3f4f6;">${i.quantity}</td>
      <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:right;border-bottom:1px solid #f3f4f6;">$${i.lineTotal.toFixed(2)}</td>
    </tr>`).join("");

  return {
    subject: `New Order: #${opts.orderNumber}`,
    html: base(`
      <div style="background:${C.ink};margin:-40px -40px 28px;padding:24px 40px;border-radius:16px 16px 0 0;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.1em;">New Order</p>
        <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">#${opts.orderNumber}</h1>
      </div>

      <p style="margin:0 0 4px;font-size:13px;color:${C.muted};">
        You've received the following order from <strong style="color:${C.textSoft};">${opts.orderedBy}</strong>:
      </p>
      <p style="margin:0 0 16px;font-size:13px;font-weight:600;color:${C.navy};">[Order #${opts.orderNumber}] (${dateStr})</p>

      <table width="100%" cellpadding="0" cellspacing="0"
        style="border:1px solid ${C.border};border-radius:10px;overflow:hidden;margin-bottom:24px;border-collapse:collapse;">
        <thead>${orderTableHeader}</thead>
        <tbody>
          ${itemRows}
          <tr>
            <td style="padding:10px 12px;font-size:13px;font-weight:600;color:${C.textSoft};border-top:1px solid ${C.border};">Subtotal:</td>
            <td style="border-top:1px solid ${C.border};"></td>
            <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:right;border-top:1px solid ${C.border};">$${opts.subtotal.toFixed(2)}</td>
          </tr>
          ${(opts.discountAmount ?? 0) > 0 ? `
          <tr>
            <td style="padding:10px 12px;font-size:13px;font-weight:600;color:#16a34a;border-top:1px solid #f3f4f6;">Coupon${opts.couponCode ? ` (${opts.couponCode})` : ""}:</td>
            <td style="border-top:1px solid #f3f4f6;"></td>
            <td style="padding:10px 12px;font-size:13px;color:#16a34a;text-align:right;border-top:1px solid #f3f4f6;">−$${(opts.discountAmount ?? 0).toFixed(2)}</td>
          </tr>` : ""}
          ${opts.shippingCost > 0 ? `
          <tr>
            <td style="padding:10px 12px;font-size:13px;font-weight:600;color:${C.textSoft};border-top:1px solid #f3f4f6;">Shipping:</td>
            <td style="border-top:1px solid #f3f4f6;"></td>
            <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:right;border-top:1px solid #f3f4f6;">$${opts.shippingCost.toFixed(2)}</td>
          </tr>` : ""}
          <tr>
            <td style="padding:10px 12px;font-size:13px;font-weight:600;color:${C.textSoft};border-top:1px solid #f3f4f6;">Payment method:</td>
            <td style="border-top:1px solid #f3f4f6;"></td>
            <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:right;border-top:1px solid #f3f4f6;">${payLabel}</td>
          </tr>
          <tr style="background:${C.surface};">
            <td style="padding:10px 12px;font-size:13px;font-weight:700;color:${C.text};border-top:1px solid ${C.border};">Total:</td>
            <td style="border-top:1px solid ${C.border};"></td>
            <td style="padding:10px 12px;font-size:13px;font-weight:700;color:${C.text};text-align:right;border-top:1px solid ${C.border};">$${opts.total.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      ${(opts.billingAddress || opts.shippingAddress) ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          ${opts.billingAddress ? `
          <td width="50%" style="vertical-align:top;padding-right:10px;">
            ${addrLabel("Billing address")}
            <div style="border:1px solid ${C.border};border-radius:8px;padding:12px 14px;">
              <p style="margin:0;font-size:13px;color:${C.textSoft};line-height:1.7;">${addrWithContact(opts.billingAddress, opts.contactEmail, opts.contactPhone)}</p>
            </div>
          </td>` : "<td width='50%'></td>"}
          ${opts.shippingAddress ? `
          <td width="50%" style="vertical-align:top;padding-left:10px;">
            ${addrLabel("Shipping address")}
            <div style="border:1px solid ${C.border};border-radius:8px;padding:12px 14px;">
              <p style="margin:0;font-size:13px;color:${C.textSoft};line-height:1.7;">${addrWithContact(opts.shippingAddress, opts.contactEmail, opts.contactPhone)}</p>
            </div>
          </td>` : "<td width='50%'></td>"}
        </tr>
      </table>` : ""}

      <p style="margin:0;font-size:13px;color:${C.muted};">
        Process your orders on the go.
      </p>
    `),
  };
}

export function orderProcessingEmail(d: OrderEmailData) {
  return {
    subject: `Your order ${d.orderNumber} is being processed`,
    html: base(`
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${C.ink};">Order In Progress</h1>
      <p style="margin:0 0 24px;font-size:15px;color:${C.muted};line-height:1.6;">
        Hi ${d.firstName}, your order <strong style="color:${C.navy};">${d.orderNumber}</strong> is being processed and prepared for shipment.
      </p>
      ${orderItemsTable(d.items)}
      <div style="background:#eff8ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 20px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:${C.navy};font-weight:600;">We'll notify you once your order ships.</p>
      </div>
    `),
  };
}

export function orderCompletedEmail(d: OrderEmailData) {
  const subtotal  = d.items.reduce((s, i) => s + i.lineTotal, 0);
  const shipping  = d.shippingCost ?? 0;
  const discount  = d.discountAmount ?? 0;
  const recipient = recipientFirstName(d);
  const greeting  = recipient ? `Hello ${recipient},` : "Hello,";

  const itemRows = d.items.map(i => `
    <tr>
      <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};border-bottom:1px solid #f3f4f6;">
        ${i.title}${i.variantSize ? `<br/><span style="font-size:12px;color:${C.muted};">Volume: ${i.variantSize}</span>` : ""}
      </td>
      <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:center;border-bottom:1px solid #f3f4f6;">${i.quantity}</td>
      <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:right;border-bottom:1px solid #f3f4f6;">$${i.lineTotal.toFixed(2)}</td>
    </tr>`).join("");

  const shippingAddrHtml = renderAddr(d.shippingAddress);
  const billingAddrHtml  = renderAddr(d.billingAddress);

  return {
    subject: `Order ${d.orderNumber} Completed — Thank You!`,
    html: base(`
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${C.ink};">Order Completed!</h1>
      <p style="margin:0 0 4px;font-size:14px;color:${C.textSoft};font-weight:500;">${greeting}</p>
      <p style="margin:0 0 24px;font-size:15px;color:${C.muted};line-height:1.6;">
        Your order <strong style="color:${C.navy};">${d.orderNumber}</strong> has been completed. Thank you for your business!
      </p>

      <table width="100%" cellpadding="0" cellspacing="0"
        style="border:1px solid ${C.border};border-radius:10px;overflow:hidden;margin-bottom:24px;border-collapse:collapse;">
        <thead>${orderTableHeader}</thead>
        <tbody>
          ${itemRows}
          <tr>
            <td colspan="2" style="padding:10px 12px;font-size:13px;color:${C.muted};border-top:1px solid ${C.border};">Subtotal</td>
            <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:right;border-top:1px solid ${C.border};">$${subtotal.toFixed(2)}</td>
          </tr>
          ${discount > 0 ? `
          <tr>
            <td colspan="2" style="padding:10px 12px;font-size:13px;color:#16a34a;border-top:1px solid #f3f4f6;">Coupon${d.couponCode ? ` (${d.couponCode})` : ""}</td>
            <td style="padding:10px 12px;font-size:13px;color:#16a34a;text-align:right;border-top:1px solid #f3f4f6;">−$${discount.toFixed(2)}</td>
          </tr>` : ""}
          <tr>
            <td colspan="2" style="padding:10px 12px;font-size:13px;color:${C.muted};border-top:1px solid #f3f4f6;">Shipping</td>
            <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:right;border-top:1px solid #f3f4f6;">${shipping > 0 ? `$${shipping.toFixed(2)}` : "Free"}</td>
          </tr>
          <tr style="background:#f0fdf9;">
            <td colspan="2" style="padding:10px 12px;font-size:13px;font-weight:700;color:#047857;border-top:1px solid #a7f3d0;">Total paid</td>
            <td style="padding:10px 12px;font-size:13px;font-weight:700;color:#047857;text-align:right;border-top:1px solid #a7f3d0;">$${d.total.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      ${(d.shippingAddress || d.billingAddress) ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          ${d.shippingAddress ? `
          <td width="50%" style="vertical-align:top;padding-right:10px;">
            ${addrLabel("Shipping address")}
            <div style="border:1px solid ${C.border};border-radius:8px;padding:12px 14px;">
              <p style="margin:0;font-size:13px;color:${C.textSoft};line-height:1.7;">${addrWithContact(d.shippingAddress, d.email, d.customerPhone)}</p>
            </div>
          </td>` : "<td width='50%'></td>"}
          ${d.billingAddress ? `
          <td width="50%" style="vertical-align:top;padding-left:10px;">
            ${addrLabel("Billing address")}
            <div style="border:1px solid ${C.border};border-radius:8px;padding:12px 14px;">
              <p style="margin:0;font-size:13px;color:${C.textSoft};line-height:1.7;">${addrWithContact(d.billingAddress, d.email, d.customerPhone)}</p>
            </div>
          </td>` : "<td width='50%'></td>"}
        </tr>
      </table>` : ""}
    `),
  };
}

export function orderCancelledEmail(d: OrderEmailData) {
  return {
    subject: `Order ${d.orderNumber} Cancelled`,
    html: base(`
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${C.ink};">Order Cancelled</h1>
      <p style="margin:0 0 24px;font-size:15px;color:${C.muted};line-height:1.6;">
        Hi ${d.firstName}, your order <strong style="color:${C.navy};">${d.orderNumber}</strong> has been cancelled.
        If you believe this is an error, please contact your administrator.
      </p>
      ${orderItemsTable(d.items)}
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 20px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#dc2626;font-weight:600;">For questions, please contact support.</p>
      </div>
    `),
  };
}

export function orderDetailsEmail(d: OrderEmailData) {
  return {
    subject: `Order Details: ${d.orderNumber}`,
    html: base(`
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${C.ink};">Order Details</h1>
      <p style="margin:0 0 24px;font-size:15px;color:${C.muted};line-height:1.6;">
        Hi ${d.firstName}, here are the details for your order <strong style="color:${C.navy};">${d.orderNumber}</strong>.
      </p>
      ${infoBox(`
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:4px 0;font-size:13px;color:${C.muted};width:140px;">Order</td>
            <td style="padding:4px 0;font-size:13px;font-weight:600;color:${C.text};">${d.orderNumber}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:${C.muted};">Status</td>
            <td style="padding:4px 0;font-size:13px;font-weight:600;color:${C.text};">${d.status.charAt(0) + d.status.slice(1).toLowerCase()}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:${C.muted};">Total</td>
            <td style="padding:4px 0;font-size:13px;font-weight:600;color:${C.text};">$${d.total.toFixed(2)}</td>
          </tr>
          ${d.trackingNumber ? `
          <tr>
            <td style="padding:4px 0;font-size:13px;color:${C.muted};">Tracking</td>
            <td style="padding:4px 0;font-size:13px;font-weight:600;color:${C.text};">${d.shippingCarrier ?? ""} ${d.trackingNumber}</td>
          </tr>` : ""}
          ${d.estimatedDelivery ? `
          <tr>
            <td style="padding:4px 0;font-size:13px;color:${C.muted};">Est. Delivery</td>
            <td style="padding:4px 0;font-size:13px;font-weight:600;color:${C.text};">${formatDateLong(d.estimatedDelivery)}</td>
          </tr>` : ""}
        </table>
      `)}
      ${orderItemsTable(d.items)}
    `),
  };
}

export function forgotPasswordEmail(opts: { firstName: string; resetLink: string }) {
  return {
    subject: "Reset Your Pronuvia Password",
    html: base(`
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${C.ink};">Reset your password</h1>
      <p style="margin:0 0 24px;font-size:15px;color:${C.muted};line-height:1.6;">
        Hi ${opts.firstName}, we received a request to reset your Pronuvia password. Click the button below to choose a new one.
      </p>
      ${btn(opts.resetLink, "Reset Password")}
      <p style="margin:0 0 8px;font-size:13px;color:${C.muted};text-align:center;">
        This link will expire in <strong>1 hour</strong>.
      </p>
      <p style="margin:0;font-size:12px;color:${C.dimmed};text-align:center;">
        If you didn&apos;t request a password reset, you can safely ignore this email.
      </p>
    `),
  };
}

// ─────────────────────────────────────────────
// Doctor registration confirmation email
// ─────────────────────────────────────────────
export function doctorRegistrationEmail(opts: {
  firstName:    string;
  lastName:     string;
  salesRepName?: string;
}) {
  const subject = "Thank You for Signing Up – Registration Received";
  const html = base(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${C.ink};">
      Thank You for Registering!
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:${C.muted};line-height:1.6;">
      Dear ${opts.firstName} ${opts.lastName},
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:${C.textSoft};line-height:1.75;">
      ${opts.salesRepName
        ? `We are glad to inform you that ${opts.salesRepName} signed up for you.`
        : "Thank you for signing up with us."
      }
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:${C.textSoft};line-height:1.75;">
      We have successfully received your registration information. Our team is currently
      reviewing your details, and your account will be verified shortly.
    </p>

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;margin:24px 0;">
      <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#92400e;">&#9203; Account Status: Under Review</p>
      <p style="margin:0;font-size:12px;color:#b45309;line-height:1.5;">
        Our team is reviewing your registration details.
      </p>
    </div>

    <p style="margin:0 0 16px;font-size:14px;color:${C.textSoft};line-height:1.75;">
      Once your account has been approved, you will receive another email confirming
      that your account is active and ready to use.
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:${C.textSoft};line-height:1.75;">
      Thank you for your patience.
    </p>

    <div style="border-top:1px solid ${C.border};padding-top:20px;margin-top:8px;">
      <p style="margin:0;font-size:14px;color:${C.textSoft};line-height:1.75;">
        Best Regards,<br/>
        <strong style="color:${C.text};">Pronuvia</strong>
      </p>
    </div>
  `);
  return { subject, html };
}

// ─────────────────────────────────────────────
// Order refund email
// ─────────────────────────────────────────────
export function orderRefundEmail(opts: {
  orderNumber:      string;
  orderDate:        Date;
  refundAmount:     number;
  reason?:          string | null;
  note?:            string | null;
  items:            { title: string; variantSize?: string; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal:         number;
  shippingCost:     number;
  couponCode?:      string | null;
  discountAmount?:  number;
  paymentMethod:    string | null;
  billingAddress?:  string | null;
  shippingAddress?: string | null;
  contactEmail?:    string | null;
  contactPhone?:    string | null;
}) {
  const subject = `Order Refunded: ${opts.orderNumber}`;

  const rows = opts.items.map((i) => `
    <tr>
      <td style="padding:10px 12px;font-size:13px;color:${C.text};border-bottom:1px solid #f3f4f6;">
        ${i.title}${i.variantSize ? ` <span style="color:${C.muted};">(${i.variantSize})</span>` : ""}
      </td>
      <td style="padding:10px 12px;font-size:13px;color:${C.muted};text-align:center;border-bottom:1px solid #f3f4f6;">${i.quantity}</td>
      <td style="padding:10px 12px;font-size:13px;font-weight:600;color:${C.text};text-align:right;border-bottom:1px solid #f3f4f6;">$${i.lineTotal.toFixed(2)}</td>
    </tr>`).join("");

  const discount = opts.discountAmount ?? 0;

  const payLabel = opts.paymentMethod === "CARD"
    ? "Credit card / debit card"
    : opts.paymentMethod === "WALLET"
    ? "Wallet balance"
    : (opts.paymentMethod ?? "—");

  // Pre-refund order total (what the customer actually paid before refund)
  const originalTotal = opts.subtotal + opts.shippingCost - discount;

  const html = base(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${C.ink};">Order Refunded: ${opts.orderNumber}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:${C.textSoft};line-height:1.6;">
      Hello, your order on Pronuvia has been refunded. Here are the details for your reference:
    </p>

    <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:${C.navy};">
      [Order #${opts.orderNumber}] (${formatDateLong(opts.orderDate)})
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:8px;overflow:hidden;margin-bottom:24px;border-collapse:collapse;">
      <thead>${orderTableHeader}</thead>
      <tbody>${rows}</tbody>
      <tbody>
        <tr style="border-top:1px solid ${C.border};">
          <td colspan="2" style="padding:10px 12px;font-size:13px;color:${C.muted};">Subtotal</td>
          <td style="padding:10px 12px;font-size:13px;font-weight:600;color:${C.text};text-align:right;">$${opts.subtotal.toFixed(2)}</td>
        </tr>
        ${discount > 0 ? `
        <tr style="border-top:1px solid #f3f4f6;">
          <td colspan="2" style="padding:10px 12px;font-size:13px;color:#16a34a;">Coupon${opts.couponCode ? ` (${opts.couponCode})` : ""}</td>
          <td style="padding:10px 12px;font-size:13px;font-weight:600;color:#16a34a;text-align:right;">−$${discount.toFixed(2)}</td>
        </tr>` : ""}
        <tr style="border-top:1px solid ${C.border};">
          <td colspan="2" style="padding:10px 12px;font-size:13px;color:${C.muted};">Shipping</td>
          <td style="padding:10px 12px;font-size:13px;font-weight:600;color:${C.text};text-align:right;">
            ${opts.shippingCost > 0 ? `$${opts.shippingCost.toFixed(2)}` : '<span style="color:#047857;">Free</span>'}
          </td>
        </tr>
        <tr style="border-top:1px solid ${C.border};">
          <td colspan="2" style="padding:10px 12px;font-size:13px;color:${C.muted};">Payment method</td>
          <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:right;">${payLabel}</td>
        </tr>
        ${opts.refundAmount > 0 ? `
        <tr style="border-top:1px solid ${C.border};">
          <td colspan="2" style="padding:10px 12px;font-size:13px;color:${C.muted};">${opts.reason ? opts.reason : "Refund"}</td>
          <td style="padding:10px 12px;font-size:13px;font-weight:600;color:#dc2626;text-align:right;">−$${opts.refundAmount.toFixed(2)}</td>
        </tr>` : ""}
        <tr style="border-top:2px solid ${C.border};background:${C.surface};">
          <td colspan="2" style="padding:12px;font-size:13px;font-weight:700;color:${C.text};">Total</td>
          <td style="padding:12px;font-size:13px;font-weight:700;color:${C.text};text-align:right;">
            <span style="text-decoration:line-through;color:${C.dimmed};margin-right:8px;">$${originalTotal.toFixed(2)}</span>
            $${Math.max(0, originalTotal - opts.refundAmount).toFixed(2)}
          </td>
        </tr>
      </tbody>
    </table>

    ${(opts.billingAddress || opts.shippingAddress) ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        ${opts.billingAddress ? `
        <td width="50%" style="vertical-align:top;padding-right:12px;">
          ${addrLabel("Billing address")}
          <div style="border:1px solid ${C.border};border-radius:8px;padding:14px;">
            <p style="margin:0;font-size:13px;color:${C.textSoft};line-height:1.7;">${addrWithContact(opts.billingAddress, opts.contactEmail, opts.contactPhone)}</p>
          </div>
        </td>` : "<td width='50%'></td>"}
        ${opts.shippingAddress ? `
        <td width="50%" style="vertical-align:top;padding-left:12px;">
          ${addrLabel("Shipping address")}
          <div style="border:1px solid ${C.border};border-radius:8px;padding:14px;">
            <p style="margin:0;font-size:13px;color:${C.textSoft};line-height:1.7;">${addrWithContact(opts.shippingAddress, opts.contactEmail, opts.contactPhone)}</p>
          </div>
        </td>` : "<td width='50%'></td>"}
      </tr>
    </table>` : ""}

    ${opts.note ? `
    <div style="background:${C.surface};border-left:3px solid ${C.navy};border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:${C.navy};text-transform:uppercase;letter-spacing:0.08em;">Note</p>
      <p style="margin:0;font-size:13px;color:${C.textSoft};line-height:1.6;white-space:pre-wrap;">${opts.note}</p>
    </div>` : ""}

    <p style="margin:0;font-size:13px;color:${C.muted};line-height:1.6;">
      We hope to see you again soon.
    </p>
  `);
  return { subject, html };
}

// ─────────────────────────────────────────────
// Shipment tracking email (patient To, physician + sales rep CC)
// ─────────────────────────────────────────────
function carrierTrackingUrl(carrier: string | null | undefined, trackingNumber: string): string | null {
  if (!carrier) return null;
  const c = carrier.toLowerCase();
  if (c.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
  if (c.includes("ups"))   return `https://www.ups.com/track?tracknum=${trackingNumber}`;
  if (c.includes("usps"))  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
  return null;
}

export function shipmentTrackingEmail(opts: {
  orderNumber:        string;
  trackingNumber:     string;
  shippingCarrier?:   string | null;
  estimatedDelivery?: Date | null;
  items:              { title: string; variantSize?: string | null; quantity: number; lineTotal: number }[];
  shippingAddress?:   string | null;
  billingAddress?:    string | null;
  total?:             number | null;
  shippingCost?:      number | null;
  couponCode?:        string | null;
  discountAmount?:    number;
  paymentMethod?:     string | null;
  contactEmail?:      string | null;
  contactPhone?:      string | null;
}) {
  const subject = `Your order #${opts.orderNumber} has shipped!`;
  const trackUrl = carrierTrackingUrl(opts.shippingCarrier, opts.trackingNumber);

  const subtotal   = opts.items.reduce((s, i) => s + i.lineTotal, 0);
  const shipping   = opts.shippingCost ?? 0;
  const discount   = opts.discountAmount ?? 0;
  const grandTotal = opts.total ?? subtotal + shipping;

  const payLabel = (() => {
    const pm = opts.paymentMethod;
    if (!pm) return null;
    if (pm === "CARD")   return "Credit / Debit Card";
    if (pm === "WALLET") return "Wallet";
    return pm;
  })();

  const itemRows = opts.items.map(i => `
    <tr>
      <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};border-bottom:1px solid #f3f4f6;">
        ${i.title}${i.variantSize ? `<br/><span style="font-size:12px;color:${C.muted};">Volume: ${i.variantSize}</span>` : ""}
      </td>
      <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:center;border-bottom:1px solid #f3f4f6;">${i.quantity}</td>
      <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:right;border-bottom:1px solid #f3f4f6;">$${i.lineTotal.toFixed(2)}</td>
    </tr>`).join("");

  const html = base(`
    <!-- Ship banner -->
    <div style="background:${C.ink};margin:-40px -40px 28px;padding:22px 40px;border-radius:16px 16px 0 0;">
      <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.1em;">Your order has shipped</p>
      <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">Order #${opts.orderNumber}</p>
    </div>

    <!-- Tracking box -->
    <div style="border:2px solid ${C.navy};border-radius:12px;padding:20px 24px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${C.muted};">Tracking Number</p>
      <p style="margin:0 0 14px;font-size:22px;font-weight:700;color:${C.navy};letter-spacing:0.05em;font-family:monospace;">${opts.trackingNumber}</p>
      ${opts.shippingCarrier ? `<p style="margin:0 0 14px;font-size:13px;color:${C.muted};">via <strong style="color:${C.textSoft};">${opts.shippingCarrier}</strong></p>` : ""}
      ${trackUrl ? btn(trackUrl, "Track My Package") : ""}
    </div>

    ${opts.estimatedDelivery ? `
    <div style="background:#f0fdf9;border:1px solid #a7f3d0;border-radius:10px;padding:14px 20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:#047857;text-transform:uppercase;letter-spacing:0.08em;">Estimated Delivery</p>
      <p style="margin:0;font-size:16px;font-weight:700;color:#047857;">${formatDateLong(opts.estimatedDelivery, { weekday: "long" })}</p>
    </div>` : ""}

    <!-- Items + order summary -->
    <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:${C.dimmed};text-transform:uppercase;letter-spacing:0.08em;">Order Summary</p>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="border:1px solid ${C.border};border-radius:10px;overflow:hidden;margin-bottom:24px;border-collapse:collapse;">
      <thead>${orderTableHeader}</thead>
      <tbody>
        ${itemRows}
        <tr>
          <td style="padding:10px 12px;font-size:13px;font-weight:600;color:${C.textSoft};border-top:1px solid ${C.border};">Subtotal:</td>
          <td style="border-top:1px solid ${C.border};"></td>
          <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:right;border-top:1px solid ${C.border};">$${subtotal.toFixed(2)}</td>
        </tr>
        ${discount > 0 ? `
        <tr>
          <td style="padding:10px 12px;font-size:13px;font-weight:600;color:#16a34a;border-top:1px solid #f3f4f6;">Coupon${opts.couponCode ? ` (${opts.couponCode})` : ""}:</td>
          <td style="border-top:1px solid #f3f4f6;"></td>
          <td style="padding:10px 12px;font-size:13px;color:#16a34a;text-align:right;border-top:1px solid #f3f4f6;">−$${discount.toFixed(2)}</td>
        </tr>` : ""}
        ${shipping > 0 ? `
        <tr>
          <td style="padding:10px 12px;font-size:13px;font-weight:600;color:${C.textSoft};border-top:1px solid #f3f4f6;">Shipping:</td>
          <td style="border-top:1px solid #f3f4f6;"></td>
          <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:right;border-top:1px solid #f3f4f6;">$${shipping.toFixed(2)}</td>
        </tr>` : ""}
        ${payLabel ? `
        <tr>
          <td style="padding:10px 12px;font-size:13px;font-weight:600;color:${C.textSoft};border-top:1px solid #f3f4f6;">Payment method:</td>
          <td style="border-top:1px solid #f3f4f6;"></td>
          <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:right;border-top:1px solid #f3f4f6;">${payLabel}</td>
        </tr>` : ""}
        <tr style="background:${C.surface};">
          <td style="padding:10px 12px;font-size:13px;font-weight:700;color:${C.text};border-top:1px solid ${C.border};">Total:</td>
          <td style="border-top:1px solid ${C.border};"></td>
          <td style="padding:10px 12px;font-size:13px;font-weight:700;color:${C.text};text-align:right;border-top:1px solid ${C.border};">$${grandTotal.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    ${(opts.billingAddress || opts.shippingAddress) ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        ${opts.billingAddress ? `
        <td width="50%" style="vertical-align:top;padding-right:10px;">
          ${addrLabel("Billing address")}
          <div style="border:1px solid ${C.border};border-radius:8px;padding:12px 14px;">
            <p style="margin:0;font-size:13px;color:${C.textSoft};line-height:1.7;">${addrWithContact(opts.billingAddress, opts.contactEmail, opts.contactPhone)}</p>
          </div>
        </td>` : "<td width='50%'></td>"}
        ${opts.shippingAddress ? `
        <td width="50%" style="vertical-align:top;padding-left:10px;">
          ${addrLabel("Shipping address")}
          <div style="border:1px solid ${C.border};border-radius:8px;padding:12px 14px;">
            <p style="margin:0;font-size:13px;color:${C.textSoft};line-height:1.7;">${addrWithContact(opts.shippingAddress, opts.contactEmail, opts.contactPhone)}</p>
          </div>
        </td>` : "<td width='50%'></td>"}
      </tr>
    </table>` : ""}

    <p style="margin:0;font-size:13px;color:${C.muted};line-height:1.6;">
      If you have any questions about your shipment, please contact us at
      <a href="mailto:contact@pronuvia.com" style="color:${C.teal};">contact@pronuvia.com</a>.
    </p>
  `);

  return { subject, html };
}

export function orderNoteEmail(opts: {
  firstName:      string;
  orderNumber:    string;
  note:           string;
  items?:         { title: string; variantSize?: string | null; quantity: number; lineTotal: number }[];
  subtotal?:      number;
  shippingCost?:  number;
  couponCode?:    string | null;
  discountAmount?: number;
  total?:         number;
  paymentMethod?: string | null;
  billingAddress?:  string | null;
  shippingAddress?: string | null;
}) {
  const items       = opts.items ?? [];
  const subtotal    = opts.subtotal ?? items.reduce((s, i) => s + i.lineTotal, 0);
  const shipping    = opts.shippingCost ?? 0;
  const discount    = opts.discountAmount ?? 0;
  const grandTotal  = opts.total ?? (subtotal + shipping - discount);
  const hasItems    = items.length > 0;

  const payLabel = (() => {
    const pm = opts.paymentMethod;
    if (!pm) return null;
    if (pm === "CARD")   return "Credit / Debit Card";
    if (pm === "WALLET") return "Wallet";
    return pm;
  })();

  const itemRows = items.map(i => `
    <tr>
      <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};border-bottom:1px solid #f3f4f6;">
        ${i.title}${i.variantSize ? `<br/><span style="font-size:12px;color:${C.muted};">Volume: ${i.variantSize}</span>` : ""}
      </td>
      <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:center;border-bottom:1px solid #f3f4f6;">${i.quantity}</td>
      <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:right;border-bottom:1px solid #f3f4f6;">$${i.lineTotal.toFixed(2)}</td>
    </tr>`).join("");

  return {
    subject: `Message regarding your order #${opts.orderNumber}`,
    html: base(`
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${C.ink};">A note about your order</h1>
      <p style="margin:0 0 20px;font-size:15px;color:${C.muted};line-height:1.6;">
        Hi ${opts.firstName}, the Pronuvia team has left a message regarding your order <strong style="color:${C.navy};">#${opts.orderNumber}</strong>.
      </p>
      <div style="background:${C.surface};border-left:3px solid ${C.teal};border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:28px;">
        <p style="margin:0;font-size:14px;color:${C.textSoft};line-height:1.7;white-space:pre-wrap;">${opts.note}</p>
      </div>

      ${hasItems ? `
      <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:${C.dimmed};text-transform:uppercase;letter-spacing:0.08em;">Order Summary</p>
      <table width="100%" cellpadding="0" cellspacing="0"
        style="border:1px solid ${C.border};border-radius:10px;overflow:hidden;margin-bottom:24px;border-collapse:collapse;">
        <thead>
          <tr style="background:${C.surface};">
            <th style="padding:10px 12px;font-size:11px;font-weight:600;color:${C.dimmed};text-transform:uppercase;letter-spacing:.06em;text-align:left;">Product</th>
            <th style="padding:10px 12px;font-size:11px;font-weight:600;color:${C.dimmed};text-transform:uppercase;letter-spacing:.06em;text-align:center;">Qty</th>
            <th style="padding:10px 12px;font-size:11px;font-weight:600;color:${C.dimmed};text-transform:uppercase;letter-spacing:.06em;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
          <tr>
            <td style="padding:10px 12px;font-size:13px;font-weight:600;color:${C.textSoft};border-top:1px solid ${C.border};">Subtotal:</td>
            <td style="border-top:1px solid ${C.border};"></td>
            <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:right;border-top:1px solid ${C.border};">$${subtotal.toFixed(2)}</td>
          </tr>
          ${discount > 0 ? `
          <tr>
            <td style="padding:10px 12px;font-size:13px;font-weight:600;color:#16a34a;border-top:1px solid #f3f4f6;">Coupon${opts.couponCode ? ` (${opts.couponCode})` : ""}:</td>
            <td style="border-top:1px solid #f3f4f6;"></td>
            <td style="padding:10px 12px;font-size:13px;color:#16a34a;text-align:right;border-top:1px solid #f3f4f6;">−$${discount.toFixed(2)}</td>
          </tr>` : ""}
          ${shipping > 0 ? `
          <tr>
            <td style="padding:10px 12px;font-size:13px;font-weight:600;color:${C.textSoft};border-top:1px solid #f3f4f6;">Shipping:</td>
            <td style="border-top:1px solid #f3f4f6;"></td>
            <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:right;border-top:1px solid #f3f4f6;">$${shipping.toFixed(2)}</td>
          </tr>` : ""}
          ${payLabel ? `
          <tr>
            <td style="padding:10px 12px;font-size:13px;font-weight:600;color:${C.textSoft};border-top:1px solid #f3f4f6;">Payment:</td>
            <td style="border-top:1px solid #f3f4f6;"></td>
            <td style="padding:10px 12px;font-size:13px;color:${C.textSoft};text-align:right;border-top:1px solid #f3f4f6;">${payLabel}</td>
          </tr>` : ""}
          <tr style="background:${C.surface};">
            <td style="padding:10px 12px;font-size:13px;font-weight:700;color:${C.text};border-top:1px solid ${C.border};">Total:</td>
            <td style="border-top:1px solid ${C.border};"></td>
            <td style="padding:10px 12px;font-size:13px;font-weight:700;color:${C.text};text-align:right;border-top:1px solid ${C.border};">$${grandTotal.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      ${(opts.billingAddress || opts.shippingAddress) ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          ${opts.billingAddress ? `
          <td width="50%" style="vertical-align:top;padding-right:10px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:${C.dimmed};text-transform:uppercase;letter-spacing:0.08em;">Billing Address</p>
            <div style="border:1px solid ${C.border};border-radius:8px;padding:12px 14px;">
              <p style="margin:0;font-size:13px;color:${C.textSoft};line-height:1.7;">${renderAddr(opts.billingAddress)}</p>
            </div>
          </td>` : ""}
          ${opts.shippingAddress ? `
          <td width="50%" style="vertical-align:top;padding-left:10px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:${C.dimmed};text-transform:uppercase;letter-spacing:0.08em;">Shipping Address</p>
            <div style="border:1px solid ${C.border};border-radius:8px;padding:12px 14px;">
              <p style="margin:0;font-size:13px;color:${C.textSoft};line-height:1.7;">${renderAddr(opts.shippingAddress)}</p>
            </div>
          </td>` : ""}
        </tr>
      </table>` : ""}
      ` : ""}

      <p style="margin:20px 0 0;font-size:12px;color:${C.dimmed};text-align:center;">
        If you have questions, please contact your administrator.
      </p>
    `),
  };
}

// ─────────────────────────────────────────────
// Commission payout approval notification
// ─────────────────────────────────────────────
export function commissionPayoutEmail(opts: {
  firstName:  string;
  amount:     number;
  period:     string;
  orderCount: number;
}) {
  const subject = `Commission Payout Approved – ${opts.period}`;
  const formattedAmount = opts.amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const html = base(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${C.ink};">Commission Payout Approved</h1>
    <p style="margin:0 0 24px;font-size:15px;color:${C.muted};line-height:1.6;">
      Hi ${opts.firstName}, your commission payout for <strong style="color:${C.navy};">${opts.period}</strong> has been reviewed and approved.
    </p>

    ${infoBox(`
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:5px 0;font-size:13px;color:${C.muted};width:140px;">Period</td>
          <td style="padding:5px 0;font-size:13px;font-weight:600;color:${C.text};">${opts.period}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;font-size:13px;color:${C.muted};">Orders</td>
          <td style="padding:5px 0;font-size:13px;font-weight:600;color:${C.text};">${opts.orderCount} commission order${opts.orderCount !== 1 ? "s" : ""}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;font-size:13px;color:${C.muted};">Payout Amount</td>
          <td style="padding:5px 0;font-size:16px;font-weight:700;color:#047857;">${formattedAmount}</td>
        </tr>
      </table>
    `)}

    <div style="background:#f0fdf9;border:1px solid #a7f3d0;border-radius:10px;padding:14px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#047857;font-weight:600;">
        &#10003; Payment is being processed to your registered bank account.
      </p>
    </div>

    <p style="margin:0 0 8px;font-size:14px;color:${C.textSoft};line-height:1.6;">
      A detailed commission statement is attached to this email as a PDF. You can download it for your records.
    </p>
    <p style="margin:0;font-size:13px;color:${C.dimmed};line-height:1.6;">
      If you have any questions about your payout, please contact your administrator.
    </p>
  `);
  return { subject, html };
}
