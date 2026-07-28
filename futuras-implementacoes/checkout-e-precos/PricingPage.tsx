import Layout from "@/components/Layout";
import { packages, memberships, giftCards, type PricingItem } from "@/data/pricing";
import { useCheckout } from "@/contexts/CheckoutContext";

const PricingCard = ({ item, onClick }: { item: PricingItem; onClick: () => void }) => (
  <div
    onClick={onClick}
    className={`relative rounded-2xl overflow-hidden aspect-square bg-gradient-to-br ${item.gradient} p-6 flex flex-col justify-end hover:scale-[1.03] transition-transform duration-300 cursor-pointer`}
  >
    <h3 className="text-sm md:text-base font-black uppercase text-foreground leading-tight tracking-wide">
      {item.name}
    </h3>
    <p className="text-sm text-foreground/70 mt-1">
      {item.price}{item.period || ""}
    </p>
  </div>
);

const PricingPage = () => {
  const { openCheckout } = useCheckout();

  return (
    <Layout>
      {/* Header */}
      <section className="bg-gradient-to-b from-coral-500/20 via-cream-100 to-cream-50 pt-20 md:pt-28 pb-8 px-6 text-center">
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider text-foreground mb-3">
          Our Pricing in Seattle
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-3">
          You can also make purchases at our studios using any bank or credit card. Please note that we do not accept cash.
        </p>
        <button className="text-xs text-muted-foreground hover:text-foreground transition-colors tracking-wide">
          ✎ CHANGE LOCATION
        </button>
      </section>

      {/* Content with sidebar nav */}
      <section className="px-6 md:px-12 pb-20 md:pb-28">
        <div className="max-w-6xl mx-auto grid md:grid-cols-12 gap-10">
          {/* Left sidebar nav — desktop only */}
          <nav className="hidden md:block md:col-span-3 lg:col-span-2 sticky top-24 self-start space-y-4 pt-4">
            <a href="#packages" className="block text-xs font-semibold text-foreground uppercase tracking-wide">
              Packages
            </a>
            <p className="text-[10px] text-muted-foreground leading-snug">
              Start now with our packages. Just pay as you go.
            </p>
            <a href="#memberships" className="block text-xs text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors">
              Memberships
            </a>
            <a href="#gift-cards" className="block text-xs text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors">
              Gift Cards
            </a>
          </nav>

          {/* Right content */}
          <div className="md:col-span-9 lg:col-span-10 space-y-20">
            {/* Packages */}
            <div id="packages">
              <div className="text-center mb-8">
                <h2 className="text-lg font-medium text-foreground">Packages</h2>
                <p className="text-sm text-muted-foreground">Seattle</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 max-w-3xl mx-auto">
                {packages.map((pkg) => (
                  <PricingCard key={pkg.id} item={pkg} onClick={() => openCheckout(pkg)} />
                ))}
              </div>
            </div>

            {/* Memberships */}
            <div id="memberships">
              <div className="text-center mb-8">
                <h2 className="text-lg font-medium text-foreground">Memberships</h2>
                <p className="text-sm text-muted-foreground">Seattle</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 max-w-3xl mx-auto">
                {memberships.map((m) => (
                  <PricingCard key={m.id} item={m} onClick={() => openCheckout(m)} />
                ))}
              </div>
            </div>

            {/* Gift Cards */}
            <div id="gift-cards">
              <div className="text-center mb-8">
                <h2 className="text-lg font-medium text-foreground">Gift Cards</h2>
              </div>
              <div className="max-w-3xl mx-auto">
                <div className="w-48">
                  <PricingCard item={giftCards[0]} onClick={() => openCheckout(giftCards[0])} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default PricingPage;
