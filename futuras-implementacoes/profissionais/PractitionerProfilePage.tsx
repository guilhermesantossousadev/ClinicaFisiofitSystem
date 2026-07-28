import { useParams, Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { practitioners } from "@/data/practitioners";
import mayaImage from "@/assets/maya-main.jpg";

const PractitionerProfilePage = () => {
  const { slug } = useParams();
  const practitioner = practitioners.find((p) => p.slug === slug) || practitioners[0];

  // Get 2 related practitioners (next in list, wrapping around)
  const currentIndex = practitioners.findIndex((p) => p.slug === slug);
  const related = [
    practitioners[(currentIndex + 1) % practitioners.length],
    practitioners[(currentIndex + 2) % practitioners.length],
  ];

  return (
    <Layout>
      <div className="grid md:grid-cols-2 min-h-[calc(100vh-72px)]">
        {/* Left — full-bleed image */}
        <div className="relative h-[60vh] md:h-auto md:sticky md:top-[72px] md:self-start md:min-h-[calc(100vh-72px)]">
          <img
            src={mayaImage}
            alt={practitioner.imageDesc}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>

        {/* Right — bio content on cream bg */}
        <div className="bg-cream-50 flex flex-col justify-center px-8 md:px-16 lg:px-20 py-16 md:py-20">
          <div className="max-w-lg mx-auto w-full text-center">
            {/* Name */}
            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl text-foreground mb-6">
              {practitioner.name}
            </h1>

            {/* Tags — outlined pills */}
            <div className="flex gap-3 justify-center mb-10">
              <span className="px-4 py-1.5 rounded-full text-sm border border-coral-400/40 text-coral-600">
                {practitioner.style}
              </span>
              <span className="px-4 py-1.5 rounded-full text-sm border border-terracotta-400/40 text-terracotta-600">
                {practitioner.specialty}
              </span>
            </div>

            {/* Bio */}
            <p className="text-foreground/75 leading-[1.8] mb-6">
              {practitioner.bio1 || `${practitioner.name} brings a ${practitioner.style.toLowerCase()} approach to ${practitioner.specialty}. Their classes are designed to help you feel empowered, centered, and alive. Every session is crafted with care and attention to each individual's journey.`}
            </p>
            <p className="text-foreground/75 leading-[1.8] mb-10">
              {practitioner.bio2 || `With years of experience and a deep passion for holistic wellness, ${practitioner.name} creates transformative experiences that go beyond physical movement. Their teaching style integrates mindful awareness with powerful movement patterns.`}
            </p>

            {/* Find out more */}
            <div className="flex items-center justify-between pt-8 border-t border-foreground/10">
              <p className="text-base font-medium text-foreground">Find out more</p>
              <div className="flex -space-x-2">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    to={`/practitioner/${r.slug}`}
                    className="w-11 h-11 rounded-full overflow-hidden border-2 border-cream-50 hover:scale-110 transition-transform"
                    title={r.name}
                  >
                    <img
                      src={mayaImage}
                      alt={r.name}
                      className="w-full h-full object-cover"
                    />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PractitionerProfilePage;
