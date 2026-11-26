import { SiteHeaderWrapper as SiteHeader } from "@/components/website/site-header-wrapper";
import { SiteFooter } from "@/components/website/site-footer";
import { TERMS, type TermsBlock } from "@/lib/content/terms";

export const metadata = { title: "Terms and Conditions – Pronuvia" };

// The text is the client's own (lib/content/terms.ts, copied from login2), so
// its inline <strong> / <a> / <br /> are rendered as they are.
const html = (b: TermsBlock) => ({ __html: b.html });

/** Consecutive list items become one list. */
function group(blocks: TermsBlock[]): (TermsBlock | TermsBlock[])[] {
  const out: (TermsBlock | TermsBlock[])[] = [];
  for (const b of blocks) {
    const last = out[out.length - 1];
    if (b.tag === "li" && Array.isArray(last)) last.push(b);
    else out.push(b.tag === "li" ? [b] : b);
  }
  return out;
}

export default function TermsPage() {
  return (
    <>
      <SiteHeader variant="solid" />

      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-sm text-gray-700 leading-relaxed [&_a]:text-[#1b3b6f] [&_a]:underline [&_strong]:font-semibold [&_strong]:text-gray-900">
          {group(TERMS).map((b, i) => {
            if (Array.isArray(b)) {
              return (
                <ul key={i} className="list-disc pl-5 space-y-1.5 mb-4">
                  {b.map((li, j) => <li key={j} dangerouslySetInnerHTML={html(li)} />)}
                </ul>
              );
            }
            if (b.tag === "h2") {
              return i === 0
                ? <h1 key={i} className="text-2xl font-bold text-gray-900 mb-8" dangerouslySetInnerHTML={html(b)} />
                : <h2 key={i} className="text-xl font-bold text-gray-900 mt-14 mb-6 pt-10 border-t border-gray-200" dangerouslySetInnerHTML={html(b)} />;
            }
            if (b.tag === "h3") return <h3 key={i} className="text-xs font-bold tracking-widest text-gray-500 uppercase mt-10 mb-3" dangerouslySetInnerHTML={html(b)} />;
            if (b.tag === "h4") return <h4 key={i} className="text-sm font-semibold text-gray-800 mt-5 mb-2" dangerouslySetInnerHTML={html(b)} />;
            return <p key={i} className="mb-4" dangerouslySetInnerHTML={html(b)} />;
          })}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
