import Layout from "@/components/Layout";

const PrivacyPage = () => (
  <Layout>
    <section className="bg-gradient-to-b from-coral-500/20 via-cream-100 to-cream-50 py-20 md:py-32 px-6 md:px-12">
      <div className="max-w-3xl mx-auto prose prose-gray">
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-8">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: March 1, 2026</p>

        <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Information We Collect</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">We collect information you provide directly, including your name, email address, phone number, payment information, and health-related information you choose to share with practitioners. We also automatically collect usage data such as pages visited, session duration, and device information.</p>

        <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">How We Use Your Information</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">Your information helps us provide and improve our services, process bookings and payments, communicate about sessions and promotions, personalize your experience, and ensure studio safety. We never sell your personal data to third parties.</p>

        <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Data Storage & Security</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">We use industry-standard encryption and security measures to protect your data. Payment information is processed through PCI-compliant payment processors and is never stored on our servers. Health information shared with practitioners is kept strictly confidential.</p>

        <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Cookies & Tracking</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">We use essential cookies to maintain your session and preferences. Analytics cookies help us understand how our website is used. You can manage your cookie preferences through your browser settings at any time.</p>

        <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Your Rights</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">You have the right to access, correct, or delete your personal data at any time. You may opt out of marketing communications while still receiving transactional emails about your bookings and membership. Contact us at privacy@thrivewellness.co to exercise any of these rights.</p>

        <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Contact</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">For privacy-related questions, contact our Data Protection Officer at privacy@thrivewellness.co or write to us at 1425 4th Avenue, Suite 200, Seattle, WA 98101.</p>
      </div>
    </section>
  </Layout>
);

export default PrivacyPage;
