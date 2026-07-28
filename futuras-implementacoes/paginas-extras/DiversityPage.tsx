import Layout from "@/components/Layout";
import { Heart, Globe, Accessibility, Users } from "lucide-react";

const commitments = [
  { icon: Heart, title: "Inclusive Practices", description: "Every session is designed to welcome all bodies, abilities, and experience levels. Our practitioners are trained in adaptive techniques and trauma-informed approaches." },
  { icon: Globe, title: "Cultural Awareness", description: "We honor the cultural origins of the movement practices we teach. Our team represents diverse backgrounds, and we actively seek practitioners who bring unique perspectives." },
  { icon: Accessibility, title: "Accessibility", description: "All studios are wheelchair accessible. We offer sliding-scale pricing, scholarship programs, and free community classes monthly to remove financial barriers." },
  { icon: Users, title: "Community Representation", description: "Our leadership team, practitioner roster, and marketing reflect the diversity of Seattle. We partner with local organizations serving underrepresented communities." },
];

const DiversityPage = () => (
  <Layout>
    <section className="bg-gradient-to-b from-coral-500/20 via-cream-100 to-cream-50 py-20 md:py-32 px-6 md:px-12">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-bold text-foreground leading-tight mb-6">
          Diversity & Inclusion
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl">
          Wellness belongs to everyone. We are committed to creating spaces where every person feels seen, valued, and empowered to move freely.
        </p>
      </div>
    </section>

    <section className="py-16 md:py-24 px-6 md:px-12">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        {commitments.map((item) => (
          <div key={item.title} className="bg-white rounded-xl shadow-md p-8 hover:shadow-xl transition-shadow duration-300">
            <item.icon className="w-10 h-10 text-coral-500 mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-3">{item.title}</h3>
            <p className="text-muted-foreground leading-relaxed">{item.description}</p>
          </div>
        ))}
      </div>
    </section>

    <section className="bg-cream-50 py-16 md:py-24 px-6 md:px-12">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-serif text-4xl md:text-5xl italic text-foreground mb-6">Our Promise</h2>
        <p className="text-lg text-muted-foreground leading-relaxed mb-4">
          We acknowledge that the wellness industry has historically excluded many communities. We are actively working to change that — through hiring, programming, pricing, and how we show up every day.
        </p>
        <p className="text-lg text-muted-foreground leading-relaxed">
          If you ever feel unwelcome in our spaces, we want to know. Reach out to our Inclusion Team at inclusion@thrivewellness.co. Your experience matters to us.
        </p>
      </div>
    </section>
  </Layout>
);

export default DiversityPage;
