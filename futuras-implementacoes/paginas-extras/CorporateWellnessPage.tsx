import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Building2, Calendar, TrendingUp, Award } from "lucide-react";

const programs = [
  { icon: Building2, title: "On-Site Sessions", description: "Bring Thrive to your office. Our practitioners lead yoga, meditation, and movement sessions right in your workspace — no mats or equipment needed." },
  { icon: Calendar, title: "Studio Memberships", description: "Give your team discounted access to all five Seattle studios. Bulk membership packages start at groups of 10 with up to 25% savings." },
  { icon: TrendingUp, title: "Wellness Workshops", description: "Half-day and full-day workshops on stress management, ergonomics, mindful leadership, and team resilience. Customized to your company's needs." },
  { icon: Award, title: "Wellness Challenges", description: "Engage your team with 30-day wellness challenges, movement streaks, and friendly competitions — all tracked through our platform." },
];

const stats = [
  { value: "87%", label: "of employees report reduced stress" },
  { value: "3.2x", label: "ROI on wellness program investment" },
  { value: "42%", label: "fewer sick days reported" },
  { value: "50+", label: "companies trust Thrive" },
];

const CorporateWellnessPage = () => (
  <Layout>
    <section className="bg-gradient-to-b from-coral-500/20 via-cream-100 to-cream-50 py-20 md:py-32 px-6 md:px-12">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-bold text-foreground leading-tight mb-6">
          Corporate Wellness
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-8">
          Invest in your team's wellbeing. Healthier, happier employees build stronger companies.
        </p>
        <Link to="/contact" className="inline-flex bg-terracotta-500 text-white px-8 py-4 rounded-full font-medium text-lg hover:bg-terracotta-600 transition-all duration-300 hover:scale-105 shadow-lg">
          Request a Proposal →
        </Link>
      </div>
    </section>

    <section className="py-16 md:py-24 px-6 md:px-12">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {stats.map((stat) => (
          <div key={stat.label}>
            <p className="text-4xl md:text-5xl font-bold text-coral-500 mb-2">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>

    <section className="bg-cream-50 py-16 md:py-24 px-6 md:px-12">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-serif text-4xl md:text-5xl italic text-foreground mb-12 text-center">Our Programs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {programs.map((program) => (
            <div key={program.title} className="bg-white rounded-xl shadow-md p-8 hover:shadow-xl transition-shadow duration-300">
              <program.icon className="w-10 h-10 text-coral-500 mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">{program.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{program.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="py-16 md:py-24 px-6 md:px-12 text-center">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Ready to get started?</h2>
        <p className="text-lg text-muted-foreground mb-8">Let's design a wellness program that fits your team, culture, and budget.</p>
        <Link to="/contact" className="inline-flex bg-coral-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-coral-600 transition-all duration-300">
          Get in Touch →
        </Link>
      </div>
    </section>
  </Layout>
);

export default CorporateWellnessPage;
