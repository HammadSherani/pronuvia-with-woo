"use server";

import path from "path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { ApprovalStatus } from "@/generated/prisma/enums";
import { generateResetToken } from "@/lib/auth/reset-token";
import { sendMail, WELCOME_EMAIL_FROM } from "@/lib/email/mailer";
import { physicianApprovalEmail, salesRepDoctorApprovedEmail } from "@/lib/email/templates";

const APPROVAL_ATTACHMENTS_DIR = path.join(process.cwd(), "lib/email/attachments/application-approval");
const WELCOME_ATTACHMENTS_DIR  = path.join(process.cwd(), "lib/email/attachments/welcome-aboard");

const welcomeEmailAttachments = [
  { filename: "AIC Therapy Dosing Protocol.pdf", path: path.join(APPROVAL_ATTACHMENTS_DIR, "ACRI AIC Therapy Dosing Protocol 2024 V3 Final_compressed.pdf") },
  { filename: "AIC Booklet.pdf",                 path: path.join(APPROVAL_ATTACHMENTS_DIR, "AIC Therapy Intro Booklet_v2.pdf") },
  { filename: "AIC Brochure.pdf",                path: path.join(APPROVAL_ATTACHMENTS_DIR, "AIC_Brochure_9x16_050222.pdf") },
  { filename: "B2B Terms and Conditions.pdf",    path: path.join(APPROVAL_ATTACHMENTS_DIR, "B2B Terms and Conditions for Doctor 08132020.pdf") },
  { filename: "W-9 Form.pdf",                    path: path.join(APPROVAL_ATTACHMENTS_DIR, "fw9.pdf") },
  { filename: "AIC for Calcium Signaling.pdf",   path: path.join(WELCOME_ATTACHMENTS_DIR, "Book_Final_CBHI-PDF_AIC.pdf") },
];

export type ApprovalActionState = {
  message?: string;
  success?: boolean;
} | undefined;

export async function listPendingPhysicians() {
  await requireAdmin();

  return prisma.partneringPhysician.findMany({
    where: { isApproved: ApprovalStatus.PENDING },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      loginId: true,
      nameOfPractice: true,
      license: true,
      phone: true,
      commission: true,
      salesRep: { select: { id: true, name: true, email: true } },
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function approvePhysician(id: string): Promise<ApprovalActionState> {
  await requireAdmin();

  const physician = await prisma.partneringPhysician.findUnique({
    where: { id },
    include: { salesRep: { select: { email: true } } },
  });
  if (!physician) {
    return { message: "Physician not found." };
  }

  if (physician.isApproved !== ApprovalStatus.PENDING) {
    return { message: "Physician is not in a pending state." };
  }

  const { token, expiry } = generateResetToken();

  await prisma.partneringPhysician.update({
    where: { id },
    data: {
      isApproved:          ApprovalStatus.APPROVED,
      passwordResetToken:  token,
      passwordResetExpiry: expiry,
    },
  });

  // Email 1: Account approval with password setup link
  //
  // These sends are deliberately awaited (not fire-and-forget): on Vercel,
  // a serverless function's execution can be frozen the moment the action
  // returns its response, which kills any still-in-flight un-awaited
  // promise (the SendGrid HTTP call included). Locally, next dev's
  // long-running process happens to let the same fire-and-forget call
  // finish anyway, which is why this previously only failed in production.
  const setupEmail = physicianApprovalEmail({
    firstName:         physician.firstName,
    lastName:          physician.lastName,
    email:             physician.email,
    loginId:           physician.loginId ?? physician.email,
    resetToken:        token,
    hasCustomPassword: physician.hasCustomPassword,
  });
  try {
    await sendMail({
      to:          physician.email,
      from:        WELCOME_EMAIL_FROM,
      subject:     setupEmail.subject,
      html:        setupEmail.html,
      attachments: welcomeEmailAttachments,
      type:        "Welcome Email",
      relatedId:   physician.id,
    });
  } catch (err) {
    console.error("[email] physicianApprovalEmail failed:", err);
  }

  // Email 2: Notify sales rep if this doctor was added by one
  if (physician.salesRep?.email) {
    const srEmail = salesRepDoctorApprovedEmail({
      doctorFirstName: physician.firstName,
      doctorLastName:  physician.lastName,
    });
    try {
      await sendMail({ to: physician.salesRep.email, subject: srEmail.subject, html: srEmail.html });
    } catch (err) {
      console.error("[email] salesRepDoctorApprovedEmail failed:", err);
    }
  }

  revalidatePath("/admin/approvals");
  revalidatePath("/admin/physicians");
  return { success: true, message: "Physician approved successfully." };
}

export async function rejectPhysician(
  id: string
): Promise<ApprovalActionState> {
  await requireAdmin();

  const physician = await prisma.partneringPhysician.findUnique({ where: { id } });
  if (!physician) {
    return { message: "Physician not found." };
  }

  if (physician.isApproved !== ApprovalStatus.PENDING) {
    return { message: "Physician is not in a pending state." };
  }

  await prisma.partneringPhysician.update({
    where: { id },
    data: { isApproved: ApprovalStatus.REJECTED },
  });

  revalidatePath("/admin/approvals");
  revalidatePath("/admin/physicians");
  return { success: true, message: "Physician rejected." };
}

