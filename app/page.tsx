import { WellnessLanding } from "@/components/website/wellness/wellness-landing";

// The landing page: the "wellness" design (components/website/wellness). The
// earlier sections (hero-section, problem-section, …) are still in
// components/website if they are wanted again.
export const metadata = { title: "Pronuvia — Calcium your cells can actually use" };

export default function HomePage() {
  return <WellnessLanding />;
}
