import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, X } from "lucide-react";
import Layout from "@/components/Layout";
import { practitioners } from "@/data/practitioners";
import practitioner1 from "@/assets/practitioner-1.jpg";
import practitioner2 from "@/assets/practitioner-2.jpg";
import practitioner3 from "@/assets/practitioner-3.jpg";

const practitionerImages = [practitioner1, practitioner2, practitioner3];

const INITIAL_COUNT = 3;

const PractitionersPage = () => {
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);

  const filtered = useMemo(() => {
    if (!search.trim()) return practitioners;
    const q = search.toLowerCase();
    return practitioners.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.style.toLowerCase().includes(q) ||
        p.specialty.toLowerCase().includes(q)
    );
  }, [search]);

  const visible = filtered.slice(0, visibleCount);

  return (
    <Layout>
      {/* Hero — warm coral gradient, massive type */}
      <section className="relative min-h-[60vh] flex flex-col justify-end bg-gradient-to-b from-coral-500/20 via-terracotta-100/30 to-cream-50">
        <div className="px-6 md:px-12 pb-6 md:pb-10 max-w-7xl w-full">
          <h1 className="text-[3rem] md:text-[6rem] lg:text-[8rem] font-black text-foreground leading-[0.85] tracking-tighter uppercase">
            Meet Our<br />Practitioners
          </h1>
          <p className="text-muted-foreground text-sm tracking-wide mt-4 uppercase">Seattle · Scroll for all ↓</p>
        </div>
      </section>

      {/* Search & Grid */}
      <section className="bg-cream-50 py-12 md:py-16 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          {/* Minimal search */}
          <div className="flex justify-end mb-10">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setVisibleCount(INITIAL_COUNT); }}
                className="w-full pl-7 pr-8 py-2 bg-transparent border-b border-muted-foreground/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground transition-colors"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-0 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Grid — 3 columns, editorial cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {visible.map((p, i) => (
              <Link
                key={p.id}
                to={`/practitioner/${p.slug}`}
                className="group block"
              >
                <div className="overflow-hidden rounded-sm mb-3">
                  <img
                    src={practitionerImages[i % practitionerImages.length]}
                    alt={p.imageDesc}
                    className="w-full aspect-square object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
                <h3 className="text-base font-semibold text-foreground group-hover:text-coral-500 transition-colors">{p.name}</h3>
                <div className="flex gap-2 mt-1.5">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-xs bg-coral-400/15 text-coral-600">{p.style}</span>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-xs bg-terracotta-100 text-terracotta-600">{p.specialty}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Load more — text link */}
          {visibleCount < filtered.length && (
            <div className="text-center mt-14">
              <button
                onClick={() => setVisibleCount((c) => c + 9)}
                className="text-sm font-medium text-foreground tracking-wide hover:underline transition-all duration-200"
              >
                SHOW MORE PRACTITIONERS →
              </button>
            </div>
          )}

          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No practitioners found matching "{search}"</p>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default PractitionersPage;
