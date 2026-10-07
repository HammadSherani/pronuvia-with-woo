import Link from "next/link";
import logo from "@/public/assets/logo.png"
import Image from "next/image";

export function PronuviaLogoDark() {
  return (
    <Link href="/" className="flex items-center gap-1.5 select-none">
     <Image src={logo} alt="Pronuvia Logo" width={1000} height={1000} className="h-auto w-32" />
    </Link>
  );
}
