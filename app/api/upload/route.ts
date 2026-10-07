import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { uploadToCloudinary } from "@/lib/cloudinary";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED   = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Only JPEG, PNG and WebP are allowed" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File exceeds 5 MB limit" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const url    = await uploadToCloudinary(buffer, "pronuvia/uploads");

  return NextResponse.json({ url });
}
