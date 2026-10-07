import { SiteHeaderWrapper as SiteHeader } from "@/components/website/site-header-wrapper";
import { SiteFooter } from "@/components/website/site-footer";
import { ContactPageClient } from "@/components/website/contact-page-client";

export const metadata = { title: "Contact – Pronuvia" };

export default function ContactPage() {
  return (
    <>
      <SiteHeader variant="solid" />
      <main>
        <ContactPageClient />
      </main>
      <SiteFooter />
    </>
  );
}
