"use client";

import { useState } from "react";
import Image from "next/image";
import faqImg from "@/public/assets/faq-img.jpg";
import heroImg from "@/public/assets/banner-2.jpg";

// ── FAQ data ──────────────────────────────────────────────────────────────────
const FAQS = [
  { id: 1, q: "Is Marah Natural Safe?", a: "Yes, Marah Natural products are made with carefully selected, clinically studied natural ingredients. All products are manufactured in certified facilities following strict quality and safety standards." },
  { id: 2, q: "Do you have any clinical trials?", a: "Our formulations are based on peer-reviewed research and published clinical studies. We work alongside researchers and healthcare professionals to validate the efficacy and safety of our ingredients." },
  { id: 3, q: "Does more Calcium in supplements lead to more Calcium absorption?", a: "Not necessarily. Calcium absorption depends on the form of calcium, vitamin D levels, and digestive health. Our formula is designed for optimal bioavailability rather than just high doses." },
  { id: 4, q: 'Why are your products labeled "Selenium Supplement" and not "Calcium Supplement"?', a: "Our products contain a synergistic blend of minerals including Selenium, which plays a critical role in bone health and antioxidant protection. The labeling reflects the primary active compound in each formula." },
  { id: 5, q: "Are there any side effects?", a: "Our products are generally well-tolerated. Some individuals may experience mild digestive discomfort initially. We recommend consulting your healthcare provider before starting any new supplement regimen." },
];

// ── Popular Topics data ───────────────────────────────────────────────────────
const TOPICS: Record<string, { q: string; a: string }[]> = {
  "MARAH NATURAL": [
    { q: "What is SAC® technology?", a: "SAC® (Soluble Algae Calcium) is Marah Natural's proprietary ionic calcium delivery system that achieves over 95% absorption — far superior to traditional calcium supplements." },
    { q: "Where is Marah Natural made?", a: "Our products are manufactured in GMP-certified facilities using the highest quality standards and ingredients sourced from pristine coastal regions of South Korea." },
    { q: "What makes Marah Natural different?", a: "Our ionic calcium formula bypasses traditional absorption barriers, delivering nutrients directly to your cells without requiring Vitamin D or peptide co-factors." },
    { q: "Is Marah Natural FDA approved?", a: "Dietary supplements are not FDA-approved, but our products are manufactured in FDA-registered, GMP-certified facilities in compliance with all applicable regulations." },
    { q: "How long has Marah Natural been in business?", a: "Marah Natural was founded after over 30 years of research and development, bringing decades of scientific expertise to our breakthrough formulations." },
  ],
  "PRODUCTS": [
    { q: "What products does Marah Natural offer?", a: "We offer our signature SAC® ionic calcium liquid supplement along with a range of supporting wellness products designed to promote bone health, cellular repair, and overall vitality." },
    { q: "How do I take the supplement?", a: "Mix the recommended dose with water or your favorite beverage. Take daily for best results. Refer to the product label for specific dosage instructions." },
    { q: "Are products suitable for vegetarians?", a: "Our core SAC® formula is derived from marine sources. Please review each product's label or contact us for specific dietary compatibility information." },
    { q: "What is the shelf life of the products?", a: "Our products have a shelf life of 24 months from the manufacture date when stored in a cool, dry place away from direct sunlight." },
  ],
  "YOUR ORDERS": [
    { q: "How do I track my order?", a: "Once your order ships, you will receive a tracking number via email. You can also log in to your account to view order status in real time." },
    { q: "Can I modify or cancel my order?", a: "Orders can be modified or cancelled within 24 hours of placement. After that window, the order may already be in fulfilment. Contact us immediately if you need changes." },
    { q: "How long does shipping take?", a: "Standard domestic shipping takes 5–7 business days. Expedited options are available at checkout. International orders may take 10–21 business days." },
    { q: "What if my order arrives damaged?", a: "Please contact our support team within 48 hours of delivery with photos of the damage. We will arrange a replacement or full refund at no cost to you." },
  ],
  "PAYMENT": [
    { q: "What payment methods do you accept?", a: "We accept all major credit and debit cards (Visa, Mastercard, Amex), PayPal, and other secure payment options available at checkout." },
    { q: "Is my payment information secure?", a: "Yes. All transactions are encrypted using industry-standard SSL technology. We do not store your full card details on our servers." },
    { q: "Do you offer payment plans?", a: "We offer flexible payment options through select third-party providers at checkout. Availability may vary based on your location and order total." },
    { q: "When will my card be charged?", a: "Your card is charged at the time of order placement. For subscription orders, billing occurs on your selected renewal date." },
  ],
  "RETURNS AND EXCHANGES": [
    { q: "What is your return policy?", a: "We offer a 30-day satisfaction guarantee. If you are not completely satisfied, return the unused portion for a full refund — no questions asked." },
    { q: "How do I initiate a return?", a: "Contact our support team with your order number and reason for return. We will provide a prepaid return label and process your refund within 5–7 business days." },
    { q: "Can I exchange a product?", a: "Yes, exchanges are available within 30 days of purchase. Contact us to arrange an exchange for a different product or size." },
    { q: "Are shipping costs refunded?", a: "Original shipping costs are non-refundable unless the return is due to a defective or incorrect item shipped by us." },
  ],
  "ACCOUNT": [
    { q: "How do I create an account?", a: "Click the 'Sign Up' button on our website and provide your name, email address, and a secure password. Verification is sent to your email." },
    { q: "How do I reset my password?", a: "Click 'Forgot Password' on the login page and enter your email. You will receive a reset link within a few minutes." },
    { q: "Can I update my billing or shipping address?", a: "Yes. Log in to your account, navigate to 'Account Settings', and update your address information at any time." },
    { q: "How do I close my account?", a: "To close your account, please contact our support team. We will process your request within 3–5 business days." },
  ],
  "SHIPPING SUPPLIERS": [
    { q: "Which carriers do you use?", a: "We partner with USPS, UPS, and FedEx for domestic shipments and DHL for international deliveries, ensuring reliable and trackable shipping worldwide." },
    { q: "Do you ship internationally?", a: "Yes, we ship to over 50 countries. International shipping rates and delivery times are calculated at checkout based on your destination." },
    { q: "Is free shipping available?", a: "We offer free standard shipping on domestic orders over a minimum threshold. Check our current promotions page for active offers." },
    { q: "Do you ship to P.O. boxes?", a: "We can ship to P.O. boxes via USPS for domestic orders. Some carriers may not deliver to P.O. boxes for international shipments." },
  ],
  "SUBSCRIPTIONS": [
    { q: "How does the subscription work?", a: "Subscribe to receive your favourite products automatically at your selected interval (monthly, bi-monthly, etc.) with a discount applied to every order." },
    { q: "Can I pause or cancel my subscription?", a: "Yes. Log in to your account and navigate to 'Subscriptions' to pause, modify, or cancel at any time before your next billing date." },
    { q: "Will I be notified before a subscription renewal?", a: "Yes, we send a reminder email 3 days before each renewal so you can make any changes in time." },
    { q: "Can I change my subscription frequency?", a: "Absolutely. You can update your delivery frequency from your account dashboard at any time." },
  ],
};

const TAB_KEYS = Object.keys(TOPICS);

// ── Sub-components ────────────────────────────────────────────────────────────
function FaqAccordion({ items }: { items: typeof FAQS }) {
  const [openId, setOpenId] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-2">
      {items.map((faq) => (
        <div key={faq.id} className="rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenId((p) => (p === faq.id ? null : faq.id))}
            className="w-full flex items-center justify-between gap-3 bg-[#1b3b6f] hover:bg-[#142d54] text-white text-sm font-semibold text-left px-5 py-4 transition-colors"
          >
            <span className="leading-snug">{faq.q}</span>
            <svg className={`w-5 h-5 shrink-0 transition-transform duration-300 ${openId === faq.id ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div className={`overflow-hidden transition-all duration-300 ${openId === faq.id ? "max-h-60" : "max-h-0"}`}>
            <div className="bg-white text-gray-600 text-sm leading-relaxed px-5 py-4 border border-t-0 border-gray-200 rounded-b-xl">
              {faq.a}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TopicAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div className="divide-y divide-gray-200">
      {items.map((item, i) => (
        <div key={i}>
          <button
            type="button"
            onClick={() => setOpenIdx((p) => (p === i ? null : i))}
            className="w-full flex items-center justify-between gap-3 py-4 text-left text-sm font-medium text-gray-800 hover:text-[#1b3b6f] transition-colors"
          >
            <span>{item.q}</span>
            <svg className={`w-4 h-4 shrink-0 text-gray-400 transition-transform duration-300 ${openIdx === i ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div className={`overflow-hidden transition-all duration-300 ${openIdx === i ? "max-h-60 pb-4" : "max-h-0"}`}>
            <p className="text-sm text-gray-500 leading-relaxed">{item.a}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function ContactPageClient() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState(TAB_KEYS[0]);
  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "", business: "",
    ageRange: "", personalGoal: "", medicalConditions: "", message: "",
  });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <>
      {/* ── 1. Hero ── */}
      <section className="relative w-full h-[55vh] min-h-[380px] overflow-hidden">
        <Image src={heroImg} alt="Contact hero" fill className="object-cover object-center" priority />
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 gap-6">
          <h1
            className="text-4xl lg:text-5xl font-normal text-white text-center"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Hello How Can We help?
          </h1>
          <div className="w-full max-w-lg relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for answers..."
              className="w-full h-12 pl-5 pr-12 rounded-xl bg-white/95 text-gray-800 text-sm placeholder-gray-400 outline-none shadow-lg"
            />
            <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </div>
        </div>
      </section>

      {/* ── 2. FAQ Section ── */}
      <section className="bg-[#1b3b6f]/15 py-16 px-6">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-12 items-start">
          {/* Left heading */}
          <div className="lg:w-64 shrink-0">
            <h2
              className="text-3xl font-normal text-gray-900 leading-snug"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Frequently Asked Questions
            </h2>
          </div>
          {/* Right accordion */}
          <div className="flex-1">
            <FaqAccordion items={FAQS} />
          </div>
        </div>
      </section>

      {/* ── 3. Popular Topics ── */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2
            className="text-3xl font-normal text-gray-900 mb-8"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Popular Topics
          </h2>

          {/* Tabs — scrollable on mobile */}
          <div className=" -mx-6 px-6 mb-8">
            <div className="flex gap-0 border-b border-gray-200 min-w-max">
              {TAB_KEYS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-xs font-semibold tracking-wide whitespace-nowrap transition-colors border-b-2 -mb-px ${
                    activeTab === tab
                      ? "border-[#1b3b6f] text-[#1b3b6f]"
                      : "border-transparent text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Topic content */}
          <div className="">
            <TopicAccordion items={TOPICS[activeTab]} />
          </div>
        </div>
      </section>

      {/* ── 4. Contact Form ── */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <h2
            className="text-3xl font-normal text-gray-900 mb-2"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Can&apos;t Find Your Question?
          </h2>
          <p className="text-sm text-gray-500 mb-10">Contact Us</p>

          {sent ? (
            <div className="bg-[#1b3b6f]/10 border border-[#1b3b6f]/30 rounded-2xl p-10 text-center">
              <svg className="w-12 h-12 text-[#1b3b6f] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              </svg>
              <p className="text-lg font-medium text-gray-800">Message Sent!</p>
              <p className="text-sm text-gray-500 mt-2">We&apos;ll get back to you within 1–2 business days.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">For The Name</label>
                  <input
                    type="text"
                    placeholder="First Name"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-[#1b3b6f] focus:ring-1 focus:ring-[#1b3b6f]/30 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Our Role</label>
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-[#1b3b6f] focus:ring-1 focus:ring-[#1b3b6f]/30 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Preferred Email (Required)</label>
                <input
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-[#1b3b6f] focus:ring-1 focus:ring-[#1b3b6f]/30 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Business Information</label>
                <input
                  type="text"
                  placeholder="Company / Organization (optional)"
                  value={formData.business}
                  onChange={(e) => setFormData({ ...formData, business: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-[#1b3b6f] focus:ring-1 focus:ring-[#1b3b6f]/30 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Age Range</label>
                  <select
                    value={formData.ageRange}
                    onChange={(e) => setFormData({ ...formData, ageRange: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm text-gray-700 outline-none focus:border-[#1b3b6f] focus:ring-1 focus:ring-[#1b3b6f]/30 transition bg-white"
                  >
                    <option value="">Select</option>
                    <option>Under 18</option>
                    <option>18 – 24</option>
                    <option>25 – 34</option>
                    <option>35 – 44</option>
                    <option>45 – 54</option>
                    <option>55 – 64</option>
                    <option>65+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Personal Goal</label>
                  <select
                    value={formData.personalGoal}
                    onChange={(e) => setFormData({ ...formData, personalGoal: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm text-gray-700 outline-none focus:border-[#1b3b6f] focus:ring-1 focus:ring-[#1b3b6f]/30 transition bg-white"
                  >
                    <option value="">Select</option>
                    <option>Bone Health</option>
                    <option>Energy & Vitality</option>
                    <option>Joint Support</option>
                    <option>Weight Management</option>
                    <option>General Wellness</option>
                    <option>Cancer Support</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Medical Conditions</label>
                  <select
                    value={formData.medicalConditions}
                    onChange={(e) => setFormData({ ...formData, medicalConditions: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm text-gray-700 outline-none focus:border-[#1b3b6f] focus:ring-1 focus:ring-[#1b3b6f]/30 transition bg-white"
                  >
                    <option value="">Select</option>
                    <option>Osteoporosis</option>
                    <option>Arthritis</option>
                    <option>Diabetes</option>
                    <option>Heart Disease</option>
                    <option>Cancer</option>
                    <option>None</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Message / Question</label>
                <textarea
                  rows={5}
                  placeholder="Describe your question in detail..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-[#1b3b6f] focus:ring-1 focus:ring-[#1b3b6f]/30 transition resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full h-12 bg-[#1b3b6f] hover:bg-[#162f5c] text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
              >
                Send Message
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
