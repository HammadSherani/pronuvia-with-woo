import { SiteHeaderWrapper as SiteHeader } from "@/components/website/site-header-wrapper";
import { SiteFooter } from "@/components/website/site-footer";
import { AboutScrollStory } from "@/components/website/about-scroll-story";

export const metadata = { title: "About – Pronuvia" };

export default function AboutPage() {
  return (
    <>
      <SiteHeader variant="solid" />
      <main>
        <AboutScrollStory />
      </main>
      <SiteFooter />
    </>
  );
}
