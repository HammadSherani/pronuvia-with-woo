import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/dal";

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const fileUrl  = searchParams.get("url");
  const filename = searchParams.get("filename");

  if (!fileUrl || !filename) {
    return new NextResponse("Missing parameters", { status: 400 });
  }

  if (!fileUrl.startsWith("https://res.cloudinary.com/")) {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  const upstream = await fetch(fileUrl);
  if (!upstream.ok) {
    return new NextResponse("File not found", { status: 404 });
  }

  const buffer = await upstream.arrayBuffer();
  const safeFilename = filename.replace(/"/g, "'");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
    },
  });
}
