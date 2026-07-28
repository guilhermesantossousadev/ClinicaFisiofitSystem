import Layout from "@/components/Layout";

const TermsPage = () => (
  <Layout>
    <section className="bg-gradient-to-b from-coral-500/20 via-cream-100 to-cream-50 py-20 md:py-32 px-6 md:px-12">
      <div className="max-w-3xl mx-auto prose prose-gray">
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-8">Terms & Conditions</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: March 1, 2026</p>

        <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">1. Membership & Packages</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">All memberships are billed monthly on the date of purchase. Packages are valid for 12 months from the date of purchase unless otherwise stated. Memberships auto-renew unless cancelled at least 7 days before the next billing cycle.</p>

        <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">2. Cancellation & Refunds</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">Session cancellations require a minimum of 12 hours' notice. Late cancellations and no-shows will be charged the full session fee. Membership cancellations take effect at the end of the current billing period. Unused sessions from packages are non-refundable but transferable to another person.</p>

        <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">3. Studio Conduct</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">We ask all members to arrive at least 5 minutes before their session. Shoes must be removed in practice spaces. Photography and recording are not permitted during sessions without prior consent. We reserve the right to refuse service to anyone who disrupts the experience of others.</p>

        <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">4. Health & Safety</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">Participation in any Thrive session is at your own risk. We recommend consulting a healthcare provider before beginning any new physical practice. Please inform your practitioner of any injuries, medical conditions, or pregnancy before your session.</p>

        <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">5. Liability</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">Thrive Wellness Collective is not liable for any personal injury, loss, or damage to personal property that may occur on studio premises. By entering our studios, you assume all risks associated with participation in wellness activities.</p>

        <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">6. Gift Cards</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">Gift cards are non-refundable and have no expiration date. They may be used toward any package, membership, or retail purchase at any Thrive studio location.</p>

        <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">7. Changes to Terms</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">We reserve the right to update these terms at any time. Members will be notified of significant changes via email. Continued use of our services after changes constitutes acceptance of the updated terms.</p>
      </div>
    </section>
  </Layout>
);

export default TermsPage;
