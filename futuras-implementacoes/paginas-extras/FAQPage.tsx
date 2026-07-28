import Layout from "@/components/Layout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  { q: "What should I bring to my first session?", a: "Just yourself and a water bottle! We provide mats, props, towels, and all the equipment you'll need. Wear comfortable clothing you can move freely in." },
  { q: "Do I need prior experience?", a: "Absolutely not. Our practitioners welcome all levels — from complete beginners to seasoned movers. Every session offers modifications so you can work at your own pace." },
  { q: "How do I book a session?", a: "You can book through our website by visiting the Practitioners page and selecting your preferred practitioner, or by calling any of our studio locations directly." },
  { q: "What's your cancellation policy?", a: "We ask for at least 12 hours' notice for cancellations. Late cancellations or no-shows will be charged the full session fee. We understand life happens — reach out if you need flexibility." },
  { q: "Can I freeze or pause my membership?", a: "Yes! You can freeze your membership for up to 30 days per year at no extra charge. Just let us know at least 48 hours before your next billing date." },
  { q: "Are your studios accessible?", a: "All five of our Seattle studios are fully wheelchair accessible with ground-level or elevator access, accessible restrooms, and adaptive equipment available upon request." },
  { q: "Do you offer private sessions?", a: "Yes, many of our practitioners offer 1-on-1 private sessions. Visit their profile page or contact us to arrange a private booking tailored to your needs." },
  { q: "What COVID-19 protocols do you follow?", a: "We maintain enhanced cleaning between all sessions, provide hand sanitizer throughout our studios, and ensure excellent ventilation. We follow all local health guidelines." },
  { q: "Can I try before committing to a membership?", a: "Of course! Our 'First 2 Sessions' package at $45 is designed exactly for that. It's the perfect way to experience Thrive before choosing a plan." },
  { q: "Do you offer corporate wellness programs?", a: "We do! We partner with companies of all sizes to bring wellness to the workplace through on-site sessions, studio memberships, and custom wellness programs. Visit our Corporate Wellness page to learn more." },
];

const FAQPage = () => {
  return (
    <Layout>
      <section className="bg-gradient-to-b from-coral-500/20 via-cream-100 to-cream-50 py-20 md:py-32 px-6 md:px-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold text-foreground leading-tight mb-4">FAQ</h1>
          <p className="text-lg text-muted-foreground mb-12">Everything you need to know about practicing with us.</p>
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="bg-white rounded-xl shadow-sm border-none px-6">
                <AccordionTrigger className="text-left font-medium text-foreground hover:text-coral-500 transition-colors">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </Layout>
  );
};

export default FAQPage;
