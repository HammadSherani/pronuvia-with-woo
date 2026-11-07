/* eslint-disable @next/next/no-img-element -- outside photos (Unsplash) at their own sizes */
import Link from "next/link";
import { DM_Sans } from "next/font/google";
import { getCurrentSession } from "@/lib/auth/dal";
import { LandingEffects, LogoMarquee } from "./landing-effects";
import "./wellness-landing.css";

// The website's landing page ("wellness" design, from pronuvia-landing-wellness.html).
// Headings use the site's Fraunces (--font-display); body text DM Sans.

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--wl-sans" });

const DASHBOARD: Record<string, string> = {
  ADMIN:     "/admin/dashboard",
  SALES_REP: "/sales/dashboard",
  PHYSICIAN: "/physician/dashboard",
};

const NAV = [
  { href: "#the-science",       label: "The Science" },
  { href: "#how-it-works",      label: "How It Works" },
  { href: "#why-ionic",         label: "Why Ionic" },
  { href: "#research",          label: "Research" },
  { href: "#for-practitioners", label: "For Practitioners" },
  { href: "#faq",               label: "FAQ" },
];

const u = (id: string, w = 900) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

const FAQ: [string, string][] = [
  ["What is \"ionic\" calcium, and why does it matter?", "Calcium is only physiologically active in its free ionic state (Ca²⁺). Most dietary and supplemental calcium arrives protein-bound and must be slowly converted. AIC delivers calcium already in the ionic form, so it's ready for the body to use."],
  ["Does more calcium mean more benefit?", "Not necessarily. What matters is the form and how long ionic calcium stays available. AIC is designed for sustained ionic calcium rather than a large dose in a slow-release form."],
  ["How is AIC taken?", "AIC is a liquid that is simply mixed into water and consumed. It's designed to be a convenient, non-invasive part of a daily routine, used under the guidance of your practitioner."],
  ["Where does the benefit come from?", "Pronuvia's role is to deliver and sustain ionic calcium. The responses that follow come from your body's own natural processes as it works to maintain healthy calcium homeostasis."],
  ["How do I get AIC?", "AIC is offered exclusively through partnering practitioners. Contact us to connect with a provider in our network."],
];

const COMPARE: [string, string][] = [
  ["Arrive protein-bound, in a slow-release standby form", "Delivered already in the active ionic Ca²⁺ form"],
  ["Only a fraction is absorbed and converted", "Absorbs directly, bypassing the need for digestion"],
  ["Depend on stomach acid, Vitamin D and peptides", "No reliance on stomach acid or Vitamin D"],
  ["Levels rise and fall quickly", "Ionic calcium stays elevated for hours"],
  ["Excess may contribute to unwanted build-up", "Supports the body's natural calcium balance"],
];

const STEPS: [string, string][] = [
  ["Delivers ionic calcium", "Antiorbital bonding releases calcium in its active Ca²⁺ form the moment it's absorbed — no conversion required."],
  ["Sustains elevated levels", "Rather than a brief spike, AIC is designed to keep serum ionic calcium elevated over many hours."],
  ["Restores homeostasis", "Sustained ionic calcium supports the body's effort to maintain healthy calcium homeostasis — its natural balance."],
  ["Cells respond", "Balanced ionic calcium supports normal cell signaling and mitochondrial function — the body's own responses do the rest."],
];

const Ticks = () => (
  <div className="ticks">{["0h", "1h", "2h", "3h", "4h", "5h", "6h"].map((t) => <span key={t}>{t}</span>)}</div>
);

export async function WellnessLanding() {
  const session = await getCurrentSession();
  const dashboardHref = session?.role ? DASHBOARD[session.role] : undefined;

  return (
    <div className={`wl ${dmSans.variable}`}>
      <LandingEffects />

      <header className="nav">
        <div className="wrap">
          <Link href="/" className="logo"><img src="/assets/logo.png" alt="Pronuvia" /></Link>
          <ul>
            {NAV.map((n) => <li key={n.href}><a href={n.href}>{n.label}</a></li>)}
          </ul>
          {dashboardHref
            ? <Link href={dashboardHref} className="btn btn-primary">Dashboard</Link>
            : <Link href="/login" className="btn btn-primary">Login</Link>}
        </div>
      </header>

      {/* HERO */}
      <section className="hero">
        <div className="wrap">
          <div>
            <span className="eyebrow">Antiorbital Ionic Calcium · AIC</span>
            <h1>Calcium your cells can <em>actually use.</em></h1>
            <p className="lead">Most calcium never reaches the form your body can put to work. Pronuvia delivers calcium in its active ionic form — and keeps ionic calcium elevated for hours, giving your cells the signal they were designed to respond to.</p>
            <div className="hero-cta">
              <a href="#how-it-works" className="btn btn-primary">See how AIC works →</a>
            </div>
            <div className="hero-note">A liquid ionic-calcium delivery system <span className="dot" /> Available through healthcare practitioners</div>
          </div>
          <div className="hero-visual">
            <div className="hero-img"><img src={u("1508672019048-805c876b67e2", 1100)} alt="Person meditating on a lakeside dock surrounded by mountains" /></div>
            <div className="float-card fc2"><strong>Ca²⁺</strong><span className="pill-ion">active · ionic</span></div>
            <div className="float-card fc1"><strong>3–4 hours per dose</strong>Sustained ionic calcium</div>
          </div>
        </div>
      </section>

      {/* PILLARS */}
      <div className="wrap">
        <div className="pillars">
          <div className="pillar reveal">
            <div className="ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="9" strokeDasharray="2 3" /></svg></div>
            <h3>Ionic</h3><p>Active Ca²⁺ form — the only physiologically active form of calcium.</p>
          </div>
          <div className="pillar reveal">
            <div className="ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 15c3-6 5-6 7-3s4 3 6-1 4-4 5-2" /></svg></div>
            <h3>Hours</h3><p>Sustained elevation — designed to maintain the signal, not spike and fade.</p>
          </div>
          <div className="pillar reveal">
            <div className="ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" /></svg></div>
            <h3>No stomach acid</h3><p>Absorption that bypasses digestion — no dependence on Vitamin D.</p>
          </div>
        </div>
      </div>

      {/* LIFESTYLE BAND */}
      <section className="lifestyle">
        <div className="wrap">
          <div className="life-grid">
            <figure className="life tall reveal"><img src={u("1506126613408-eca07ce68773")} alt="Woman meditating at sunrise" loading="lazy" /></figure>
            <div className="life-copy reveal">
              <span className="eyebrow">Wellness from within</span>
              <h2>Balance begins at the <em>cellular level.</em></h2>
              <p className="lead">A simple daily ritual that supports the body&apos;s own natural rhythm — so you can focus on living well.</p>
            </div>
            <figure className="life reveal"><img src={u("1490645935967-10de6ba17061")} alt="Nourishing whole-food breakfast" loading="lazy" /></figure>
            <figure className="life reveal"><img src={u("1545205597-3d9d02c29597")} alt="Group practising yoga on the beach" loading="lazy" /></figure>
          </div>
        </div>
      </section>

      {/* THE CALCIUM PROBLEM */}
      <section id="the-science">
        <div className="wrap">
          <div className="center reveal">
            <span className="eyebrow">The calcium problem</span>
            <h2 style={{ fontSize: "clamp(36px,4.5vw,56px)", margin: "18px 0 20px" }}>Not all calcium <em>works the same way.</em></h2>
            <p className="lead">Calcium is only active in its free ionic state (Ca²⁺). Yet nearly all dietary and supplemental calcium ends up protein-bound — a slow-release &quot;standby&quot; form the body converts only gradually.</p>
          </div>
          <div className="compare">
            <div className="cmp old reveal">
              <span className="tag">Conventional calcium</span>
              <div className="state">Locked in standby</div>
              <h3>Slow to arrive.<br />Slow to convert.</h3>
              <p>Tablets and food-based calcium arrive protein-bound. Only a small fraction is absorbed, and the body must slowly convert it — a process that depends on stomach acid, Vitamin D, and healthy digestion that many people lack.</p>
              <svg className="curve" viewBox="0 0 400 90" preserveAspectRatio="none"><line x1="0" y1="22" x2="400" y2="22" stroke="#D9CDB9" strokeDasharray="3 5" /><path d="M0 87 L14 87 C21 87 24 60 29 60 C34 60 37 87 46 87 L400 87 Z" fill="rgba(201,139,107,.18)" /><path d="M0 87 L14 87 C21 87 24 60 29 60 C34 60 37 87 46 87 L400 87" fill="none" stroke="#C98B6B" strokeWidth="2.5" vectorEffect="non-scaling-stroke" /><line x1="0" y1="88" x2="400" y2="88" stroke="#D9CDB9" /></svg>
              <Ticks />
              <div className="curve-label">Small, brief spike · Gone within the hour</div>
            </div>
            <div className="cmp new reveal">
              <span className="tag">Pronuvia AIC</span>
              <div className="state">Ready to act</div>
              <h3>Active on arrival.<br />Sustained 3–4 hours.</h3>
              <p>Antiorbital Ionic Calcium is delivered already in the ionic Ca²⁺ form and stays elevated for 3–4 hours with each dose — so the calcium signal your cells rely on is present and sustained, not fleeting.</p>
              <div className="curve-wrap"><span className="plateau">≈ 3–4 hours per dose</span>
                <svg className="curve" viewBox="0 0 400 90" preserveAspectRatio="none"><path d="M0 87 C18 87 26 24 52 22 C110 18 200 18 248 24 C272 28 286 87 322 87 L400 87 Z" fill="rgba(185,205,182,.16)" /><path d="M0 87 C18 87 26 24 52 22 C110 18 200 18 248 24 C272 28 286 87 322 87 L400 87" fill="none" stroke="#B9CDB6" strokeWidth="2.5" vectorEffect="non-scaling-stroke" /><line x1="0" y1="88" x2="400" y2="88" stroke="rgba(255,255,255,.15)" /></svg>
              </div>
              <Ticks />
              <div className="curve-label">Rises quickly · Plateaus 3–4 hours · Then tapers</div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW AIC WORKS */}
      <section id="how-it-works" className="how">
        <div className="wrap">
          <div className="center reveal">
            <span className="eyebrow">How AIC works</span>
            <h2 style={{ fontSize: "clamp(36px,4.5vw,56px)", margin: "18px 0 20px" }}>A delivery system, <em>not just another calcium.</em></h2>
            <p className="lead">Pronuvia&apos;s approach is built around one idea: give the body sustained access to ionic calcium, then let the body do what it naturally does with it.</p>
          </div>
          <div className="steps">
            {STEPS.map(([h, p], i) => (
              <div key={h} className="step reveal"><div className="step-num">{String(i + 1).padStart(2, "0")}</div><h3>{h}</h3><p>{p}</p></div>
            ))}
          </div>
          <div className="quote quote-img reveal" style={{ backgroundImage: `linear-gradient(rgba(47,66,52,.55),rgba(47,66,52,.65)),url('${u("1474418397713-7ede21d49118", 1600)}')` }}>
            <blockquote>&quot;We do not push the body toward an outcome. We restore a signal it already knows how to read.&quot;</blockquote>
            <cite>The Pronuvia approach</cite>
          </div>
        </div>
      </section>

      {/* WHY IONIC MATTERS */}
      <section id="why-ionic" className="why">
        <div className="wrap">
          <div className="reveal">
            <span className="eyebrow">Why ionic matters</span>
            <h2>Absorption isn&apos;t the whole story — <em>form is.</em></h2>
            <p className="lead">What sets AIC apart isn&apos;t simply how much calcium is absorbed, but that it arrives active and stays active long enough to matter.</p>
            <figure className="why-img"><img src={u("1548839140-29a749e1cf4d")} alt="Fresh water pouring into a glass" loading="lazy" /><figcaption>Mixed into water. Taken daily.</figcaption></figure>
          </div>
          <div className="table reveal">
            <div className="table-head"><div>Other calcium sources</div><div>Pronuvia AIC</div></div>
            {COMPARE.map(([a, b]) => (
              <div key={a} className="row"><div><span className="x">✕</span>{a}</div><div><span className="v">✓</span>{b}</div></div>
            ))}
          </div>
        </div>
      </section>

      {/* THE BODY DOES THE WORK */}
      <section className="benefits">
        <div className="wrap">
          <div className="center reveal">
            <span className="eyebrow">The body does the work</span>
            <h2 style={{ fontSize: "clamp(36px,4.5vw,56px)", margin: "18px 0 20px" }}>We deliver the signal. <em>Your body responds.</em></h2>
            <p className="lead">Pronuvia doesn&apos;t force an outcome. By restoring sustained ionic calcium, AIC supports the conditions your body needs — and the body&apos;s own natural responses follow.</p>
          </div>
          <div className="ben-grid">
            <div className="ben reveal">
              <svg className="ben-shape" viewBox="0 0 84 84"><circle cx="42" cy="42" r="40" fill="#E5ECE3" /><circle cx="42" cy="42" r="10" fill="#7E9A82" /><g stroke="#7E9A82" strokeWidth="1.5" fill="none"><path d="M42 32V14M42 52v18M32 42H14M52 42h18" /></g></svg>
              <h3>Cell signaling</h3><p>Ionic calcium is a primary messenger inside cells. Sustained, balanced levels help support normal calcium-driven cell signaling.*</p>
            </div>
            <div className="ben reveal">
              <svg className="ben-shape" viewBox="0 0 84 84"><circle cx="42" cy="42" r="40" fill="#F1DCCD" /><ellipse cx="42" cy="42" rx="24" ry="14" fill="none" stroke="#C98B6B" strokeWidth="2" /><path d="M24 42c5-7 9 7 14 0s9 7 14 0 7 6 8 3" fill="none" stroke="#C98B6B" strokeWidth="1.6" /></svg>
              <h3>Mitochondrial function</h3><p>Healthy calcium balance supports normal mitochondrial function — part of how cells maintain their everyday energy and resilience.*</p>
            </div>
            <div className="ben reveal">
              <svg className="ben-shape" viewBox="0 0 84 84"><circle cx="42" cy="42" r="40" fill="#EFE6D8" /><path d="M22 50h40M42 50V28" stroke="#4F6B55" strokeWidth="2" /><circle cx="28" cy="40" r="7" fill="none" stroke="#4F6B55" strokeWidth="2" /><circle cx="56" cy="40" r="7" fill="none" stroke="#4F6B55" strokeWidth="2" /><path d="M28 33l14-6 14 6" fill="none" stroke="#4F6B55" strokeWidth="1.6" /></svg>
              <h3>Calcium homeostasis</h3><p>By supplying calcium in its active form, AIC supports the body&apos;s effort to maintain healthy calcium homeostasis.*</p>
            </div>
          </div>
          <p className="fine">* These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.</p>
        </div>
      </section>

      {/* RESEARCH */}
      <section id="research" className="research">
        <div className="wrap center reveal">
          <span className="eyebrow">Research</span>
          <h2>Developed and studied <em>in collaboration.</em></h2>
          <p className="lead">Antiorbital Ionic Calcium was developed through collaborative research and continues to be studied with universities, research institutes, and clinicians. Our marketing is grounded in that science — not in promises.</p>
          <div className="partners"><span>Calcium &amp; Bone Health Institute</span><span>University Research Partners</span></div>
        </div>
        <div className="logo-band"><LogoMarquee /></div>
      </section>

      {/* PRACTITIONERS + RITUAL */}
      <section id="for-practitioners" className="ritual" style={{ paddingTop: 20 }}>
        <div className="wrap">
          <div className="card-dark reveal" style={{ backgroundImage: `linear-gradient(180deg,rgba(47,66,52,.78),rgba(47,66,52,.95)),url('${u("1559839734-2b71ea197ec2", 1000)}')`, backgroundSize: "cover", backgroundPosition: "center 20%" }}>
            <span className="eyebrow">For practitioners</span>
            <h2>Offer AIC in your practice.</h2>
            <p>Pronuvia AIC reaches patients only through partnering practitioners. Join the network to order for your practice.</p>
            <Link href="/account" className="btn">Become a partner →</Link>
          </div>
          <div className="card-light reveal">
            <img className="ritual-img" src={u("1520206183501-b80df61043c2")} alt="Woman resting peacefully" loading="lazy" />
            <span className="eyebrow">A simple daily ritual</span>
            <h3>Mixed into water. Taken daily.</h3>
            <div className="journey">
              <div className="j"><div className="j-n">1</div><div><b>Pronuvia</b><span>AIC formulation</span></div></div>
              <div className="j"><div className="j-n">2</div><div><b>Practitioner</b><span>guides therapy</span></div></div>
              <div className="j"><div className="j-n">3</div><div><b>Patient</b><span>daily routine</span></div></div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="faq">
        <div className="wrap">
          <div className="reveal">
            <span className="eyebrow">FAQ</span>
            <h2>Questions, <em>answered.</em></h2>
            <img className="faq-img" src={u("1470252649378-9c29740c9fa8")} alt="Sunrise over a calm meadow" loading="lazy" />
          </div>
          <div className="reveal">
            {FAQ.map(([q, a], i) => (
              <details key={q} open={i === 0}><summary>{q}</summary><p>{a}</p></details>
            ))}
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="foot">
            <div>
              <Link href="/" className="logo logo-light"><img src="/assets/logo.png" alt="Pronuvia" /></Link>
              <p className="foot-tag">A liquid ionic-calcium delivery system. Antiorbital Ionic Calcium (AIC) — available through healthcare practitioners.</p>
            </div>
            <div><h4>Explore</h4><ul>{NAV.map((n) => <li key={n.href}><a href={n.href}>{n.label}</a></li>)}</ul></div>
            <div><h4>Company</h4><ul><li><Link href="/contact">Contact</Link></li><li><Link href="/terms">Terms</Link></li></ul></div>
            <div><h4>Practitioners</h4><ul><li><Link href="/account">Sign up</Link></li><li><Link href="/login">Partner Login</Link></li></ul></div>
          </div>
          <p className="disclaimer">* Disclaimer — These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease. Pronuvia products are dietary supplements and are not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare practitioner before beginning any supplement. Individual experiences vary.</p>
          <div className="copy"><span>© {new Date().getFullYear()} Pronuvia. All rights reserved.</span><span>AIC · Ca²⁺</span></div>
        </div>
      </footer>
    </div>
  );
}
