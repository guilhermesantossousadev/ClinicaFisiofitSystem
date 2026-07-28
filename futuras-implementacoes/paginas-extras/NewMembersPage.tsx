import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import heroImage from "@/assets/new-members-hero.jpg";
import communityImage from "@/assets/community-class.jpg";
import studioInterior from "@/assets/studio-interior.jpg";
import pricingYoga from "@/assets/pricing-yoga.jpg";

const NewMembersPage = () => {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative h-screen flex items-end">
        <img src={heroImage} alt="Joyful person with arms raised in wellness class" className="absolute inset-0 w-full h-full object-cover" width={1200} height={1600} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-coral-500/20" />
        <div className="relative z-10 px-6 md:px-12 pb-16 md:pb-24 max-w-4xl space-y-4">
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold uppercase tracking-wider text-white leading-none">
            New Members
          </h1>
          <p className="text-lg md:text-xl text-white/90 max-w-xl">
            Start your journey to holistic wellness. Every practice matters. Every session counts.
          </p>
          <Link to="#story" className="inline-flex text-white font-medium hover:underline text-sm uppercase tracking-widest">
            Learn more <span className="ml-2">→</span>
          </Link>
        </div>
      </section>

      {/* Story */}
      <section id="story" className="py-24 md:py-32 px-6 md:px-12">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <img src={communityImage} alt="Community in mindful movement practice" className="w-full h-[28rem] object-cover rounded-xl shadow-lg" loading="lazy" width={1200} height={800} />
          <div className="space-y-6">
            <h2 className="font-serif text-5xl md:text-7xl italic text-foreground">Our Story</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              We empower our community to feel strong, centered, and alive. Every day. Every practice.
            </p>
          </div>
        </div>
      </section>

      {/* Discovery Gallery */}
      <section className="py-24 md:py-32 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-serif text-4xl md:text-5xl italic text-foreground mb-12 text-center">Discover more about us</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: "Meet our practitioners", img: communityImage, link: "/practitioners" },
              { title: "Discover our studios", img: studioInterior, link: "/studios" },
              { title: "View pricing options", img: pricingYoga, link: "/pricing" },
            ].map((card) => (
              <Link
                key={card.title}
                to={card.link}
                className="relative group overflow-hidden h-96"
              >
                <img src={card.img} alt={card.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />
                <div className="absolute inset-0 bg-foreground/40 group-hover:bg-foreground/50 transition-colors flex items-center justify-center">
                  <h3 className="text-white text-lg font-bold uppercase tracking-widest text-center px-6">{card.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default NewMembersPage;
