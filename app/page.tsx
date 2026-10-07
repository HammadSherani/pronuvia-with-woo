import { prisma }        from "@/lib/db/prisma";
import { SiteHeaderWrapper as SiteHeader } from "@/components/website/site-header-wrapper";
import { HeroSection }   from "@/components/website/hero-section";
import { MarqueeStrip }  from "@/components/website/marquee-strip";
import { ProblemSection }      from "@/components/website/problem-section";
import { HowItWorksSection }   from "@/components/website/how-it-works-section";
import { TheScienceSection }   from "@/components/website/science-section-new";
import { BodyResponseSection } from "@/components/website/body-response-section";
import { ResearchSection }       from "@/components/website/research-section";
import { PractitionersSection }  from "@/components/website/practitioners-section";
import { FaqSectionNew }         from "@/components/website/faq-section-new";
import { AboutSection }          from "@/components/website/about-section";
import { TestimonialsSection } from "@/components/website/testimonials-section";
import { ReviewsSection }      from "@/components/website/reviews-section";
import { ScienceSection }      from "@/components/website/science-section";
import { BlogSection }         from "@/components/website/blog-section";
import { SocialSection }       from "@/components/website/social-section";
import { WhyChooseSection }    from "@/components/website/why-choose-section";
import { PartnersSection }      from "@/components/website/partners-section";
import { FeaturedImageSection } from "@/components/website/featured-image-section";
import { InsiderSection }       from "@/components/website/insider-section";
import { FaqSection }          from "@/components/website/faq-section";
import { SiteFooter }         from "@/components/website/site-footer";

export default async function HomePage() {
  const [, blogPosts] = await Promise.all([
    Promise.resolve([]),
    prisma.blog.findMany({
      where:   { isPublished: true },
      orderBy: { publishedAt: "desc" },
      take:    3,
      select:  { id: true, title: true, slug: true, excerpt: true, imageUrl: true },
    }),
  ]);

  return (
    <>
    <main>
      <SiteHeader />
      <HeroSection />
      <MarqueeStrip />
      <ProblemSection />
      <HowItWorksSection />
      <TheScienceSection />
      <BodyResponseSection />
      <ResearchSection />
      <PractitionersSection />
      <FaqSectionNew />
      {/* <AboutSection /> */}
      {/* <TestimonialsSection /> */}
      {/* <ScienceSection /> */}
      {/* <BlogSection posts={blogPosts} /> */}
      {/* <SocialSection /> */}
      {/* <WhyChooseSection /> */}
      {/* <PartnersSection /> */}
      {/* <InsiderSection /> */}
      {/* <ReviewsSection /> */}
      {/* <FeaturedImageSection /> */}
      {/* <FaqSection /> */}
    </main>
    <SiteFooter />
    </>
  );
}
