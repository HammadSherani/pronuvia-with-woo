import { SiteHeaderWrapper as SiteHeader } from "@/components/website/site-header-wrapper";
import { SiteFooter } from "@/components/website/site-footer";

export const metadata = { title: "Terms and Conditions – Pronuvia" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-3">{title}</h2>
      <div className="text-sm text-gray-700 leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

export default function TermsPage() {
  return (
    <>
      <SiteHeader variant="solid" />

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Terms and Conditions         </h1>
        <p className="text-xs text-gray-400 mb-10">Last updated: 2026</p>

        <div className="text-sm text-gray-700 leading-relaxed space-y-4 mb-10">
          <p>
            On this website, Advanced Calcium Research Institute (ACRI) shares information on ionic calcium therapy.
            The therapy itself involves the use of specialized products, namely AIC calcium products manufactured by
            Marahdeo in Canada and distributed by Pronuvia in the US. Both manufacturing and
            distribution companies do not make any claims about disease treatments and sell AIC calcium product as
            what it is, a calcium supplement with a higher ionic absorption rate. ACRI believes, however, that AIC
            ionic calcium has manifold health benefits if taken in multiple daily doses, enough to trigger calcium
            homeostasis.
          </p>
          <p>
            The purpose of this registration is to connect interested health practitioners to purchase AIC products
            for the purpose of participating in clinical research together. Please read these Terms and Conditions
            carefully before submitting registration. Using ionic calcium products for clinical purposes is a
            healthcare professional&apos;s sole decision and has no bearing on the manufacturer or distributor of
            the products. Both the manufacturer and distributors make no claims to treat diseases. The scientific
            research and clinical cases shared on this website serve as notable clinical samples only and do not
            guarantee the same results in the practitioner&apos;s clinical application.
          </p>
        </div>

        <Section title="The Scope of Practice">
          <p>
            We ask approved doctors and health practitioners to limit the use of AIC (Antiorbital Ionic Calcium)
            therapy within the legally allowed scope of the license in treating patients. For example, for
            nutritionists, AIC therapy can be utilized to treat ionic calcium deficiency, restore calcium
            homeostasis, boost the immune system, balance the body pH, and other general calcium-related health
            issues from a nutritional therapy point of view.
          </p>
        </Section>

        <Section title="This Website Does Not Provide Medical or Professional Services or Advice">
          <p>
            The content on this website is intended to be a general information resource regarding the subject
            matter covered. Practitioners are encouraged to confirm the information contained herein with other
            sources and to review the information carefully with participating colleagues. ACRI is not engaged in
            rendering medical or similar professional services or advice via this website, and the information
            provided is not intended to replace medical advice. The scientific research and clinical cases shared on
            this website serve as notable clinical samples only and do not guarantee the same results in the
            practitioner&apos;s clinical application.
          </p>
        </Section>

        <Section title="Scope of Use">
          <p>
            No part of any content or software on this website may be copied, downloaded, or stored in a retrieval
            system for any other purpose, nor may it be redistributed for any purpose without the expressed written
            permission of ACRI. ACRI may discontinue, change or restrict your use of this website for any reason
            without notice. By using this website, you represent that you are at least 18 years old, a U.S.
            resident, and a licensed healthcare professional.
          </p>
        </Section>

        <Section title="No Warranties">
          <p>
            All content on this website is provided to you on an &quot;as is&quot; &quot;as available&quot; basis
            without warranty of any kind either express or implied, including but not limited to any implied
            warranties of merchantability, fitness for a particular purpose, accuracy and non-infringement. ACRI
            makes no warranty on the accuracy, completeness, currency, or reliability of any content available
            through this website. You are responsible for verifying any information before relying on it. Use of
            the website and the content available on the website is at your sole risk. ACRI makes no
            representations or warranties that use of the website will be uninterrupted or error-free. You are
            responsible for taking all necessary precautions to ensure that any content you may obtain from the
            website is free of viruses.
          </p>
          <p>
            Any product-related issues must be addressed to the distributor and not to ACRI. ACRI does not
            manufacture nor sell any products.
          </p>
        </Section>

        <Section title="Limitation of Liability; No Duty to Update">
          <p>
            Your use of the website or any content on the website is at your own risk. ACRI specifically disclaims
            any liability, whether based in contract, tort, strict liability, or otherwise, for any direct,
            indirect, incidental, consequential, or special damages arising out of or in any way connected with
            access to or use of the website, even if ACRI has been advised of the possibility of such damages,
            including but not limited to reliance by any party on any content obtained through the use of the
            website, or that arises in connection with mistakes or omissions in, or delays in transmission of,
            information to or from the user, interruptions in telecommunications connections to the website or
            viruses, whether caused in whole or in part by negligence, acts of God, telecommunications failure,
            theft or destruction of, or unauthorized access to the website, or related information or programs.
          </p>
          <p>
            ACRI does not warrant that the functions contained in this website are free of computer viruses or
            other harmful components. Although the content of this website is updated periodically, ACRI does not
            have a duty to update the information contained in this website, and ACRI will not be liable for any
            failure to update such information. ACRI does not assume any responsibility or liability for the
            accuracy, completeness, reliability, or usefulness of the information disclosed or accessed through
            this website. It is your responsibility to verify any information on this website before relying upon
            it.
          </p>
        </Section>

        <Section title="Intellectual Property Rights">
          <p>
            All content of this website is protected by U.S. and foreign copyright laws. You may not copy, modify,
            upload, download, post, transmit, republish, or distribute any of the content, including without
            limitation the code, contained in this website without our prior written permission except for your own
            personal, non-commercial purposes. Except as provided in the preceding sentence, nothing contained in
            this website shall be construed as granting a license or other rights under any patent, trademark,
            copyright, or other intellectual property of ACRI or any third party. Unauthorized use of any ACRI
            trademark, service mark, or logo may be a violation of federal and state trademark laws.
          </p>
        </Section>

        <Section title="Links">
          <p>
            This website may contain links to websites operated by other parties. The linked sites are not under
            the control of ACRI, and ACRI is not responsible for the content available on any other Internet sites
            linked to this website. Such links do not imply ACRI&apos;s endorsement of material on any other site
            and ACRI disclaims all liability concerning your access to such linked websites. ACRI provides links to
            other Internet sites as a convenience to users, and access to any other Internet sites linked to this
            website is at your own risk.
          </p>
        </Section>

        <Section title="Location and Governing Law">
          <p>
            ACRI makes no representation that the
            information on the website is appropriate or available for use in other locations, and access to the
            ACRI website from territories where the content of the ACRI website may be illegal is prohibited. Those
            who choose to access the ACRI website from other locations do so on their initiative and are responsible
            for compliance with applicable local laws.
          </p>
        </Section>

        <Section title="Severability">
          <p>
            If any provision of these Terms and Conditions of Use is held invalid or unenforceable by any court of
            competent jurisdiction, the other provisions of these Terms and Conditions of Use shall remain in full
            force and effect. Any provision of these Terms and Conditions of Use held invalid or unenforceable only
            in part or degree will remain in full force and effect to the extent not held invalid or unenforceable.
            The parties further agree to replace such invalid or unenforceable provision of these Terms and
            Conditions of Use with a valid and enforceable provision that will achieve, to the extent possible, the
            economic, business and other purposes of such invalid or unenforceable provision.
          </p>
        </Section>

        <Section title="Violations and Additional Policies">
          <p>
            ACRI reserves the right to seek all remedies available at law and in equity for violations of the rules
            and regulations set forth in this website, including the right to block access from a particular
            Internet address to the website.
          </p>
        </Section>

        <Section title="Questions">
          <p>
            If you have any questions about these Terms and Conditions of Use, please contact the relevant
            individual listed in the Contact Us section of this website.
          </p>
        </Section>
      </main>

      <SiteFooter />
    </>
  );
}
