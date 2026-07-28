import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, CreditCard, X } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { type PricingItem } from "@/data/pricing";
import { type SessionMetadata } from "@/contexts/CheckoutContext";

interface CheckoutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PricingItem | null;
  sessionMeta?: SessionMetadata | null;
}

const inputClass =
  "w-full bg-white/50 backdrop-blur-sm border-0 rounded-lg px-5 py-4 text-sm tracking-widest uppercase placeholder:text-muted-foreground/70 placeholder:tracking-widest focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all";

const CheckoutSheet = ({ open, onOpenChange, item, sessionMeta }: CheckoutSheetProps) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [billingData, setBillingData] = useState({
    address: "",
    city: "",
    postalCode: "",
    country: "US",
  });
  const [paymentMethod, setPaymentMethod] = useState<"card" | "paypal">("card");
  const [promoCode, setPromoCode] = useState("");
  const [giftCode, setGiftCode] = useState("");
  const [giftPin, setGiftPin] = useState("");

  const resetAndClose = () => {
    setStep(1);
    onOpenChange(false);
  };

  if (!item) return null;

  return (
    <Sheet open={open} onOpenChange={resetAndClose}>
      <SheetContent side="right" className="w-full sm:max-w-[50vw] p-0 border-0 [&>button]:hidden">
        {step === 3 ? (
          /* Confirmation */
          <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-coral-400/30 via-terracotta-100/40 to-cream-100 px-8 text-center">
            <span className="font-serif italic text-5xl md:text-6xl text-foreground">Thank you</span>
            <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-wider text-foreground mt-2">
              for your purchase
            </h2>
            <p className="text-sm text-muted-foreground mt-4 max-w-sm">
              Your {item.name.toLowerCase()} has been added to your account. You're ready to book your next session.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-10 w-full max-w-sm">
              <Link
                to="/practitioners"
                onClick={resetAndClose}
                className="flex-1 border border-foreground text-foreground bg-transparent py-3.5 rounded-lg font-medium uppercase tracking-widest text-xs hover:bg-foreground hover:text-background transition-all duration-300 inline-flex items-center justify-center gap-2"
              >
                Book a session <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={resetAndClose}
                className="flex-1 border border-foreground text-foreground bg-transparent py-3.5 rounded-lg font-medium uppercase tracking-widest text-xs hover:bg-foreground hover:text-background transition-all duration-300 inline-flex items-center justify-center gap-2"
              >
                Back home <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* Steps 1 & 2 — single column layout */
          <div className="h-full flex flex-col bg-gradient-to-b from-coral-400/20 via-cream-100 to-cream-50 overflow-y-auto">
            {/* Header */}
            <div className="p-8 md:p-10 pb-0">
              <button
                onClick={resetAndClose}
                className="p-2 rounded-full hover:bg-white/30 transition-colors -ml-2 mb-4"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-foreground" />
              </button>
              <span className="font-serif italic text-3xl md:text-4xl text-foreground">Your</span>
              <h2 className="text-xl md:text-2xl font-bold uppercase tracking-wider text-foreground">Order</h2>

              {/* Order line item */}
              <div className="mt-6 flex items-center gap-2">
                <span className="bg-foreground text-background text-[10px] font-bold w-5 h-5 rounded-full inline-flex items-center justify-center">1</span>
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground">{item.name}</p>
              </div>
              {item.period && (
                <p className="text-[10px] text-muted-foreground mt-1 ml-7 uppercase tracking-wider">Auto-renewal{item.period}</p>
              )}
            </div>

            {/* Form area */}
            <div className="flex-1 p-8 md:p-10 pt-6">
              {step === 1 ? (
                <div className="space-y-6">
                  <div>
                    <span className="font-serif italic text-2xl text-foreground">Billing</span>
                    <h3 className="text-lg font-bold uppercase tracking-wider text-foreground">Address</h3>
                  </div>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="ADDRESS"
                      value={billingData.address}
                      onChange={(e) => setBillingData({ ...billingData, address: e.target.value })}
                      className={inputClass}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="CITY"
                        value={billingData.city}
                        onChange={(e) => setBillingData({ ...billingData, city: e.target.value })}
                        className={inputClass}
                      />
                      <input
                        type="text"
                        placeholder="POSTAL CODE"
                        value={billingData.postalCode}
                        onChange={(e) => setBillingData({ ...billingData, postalCode: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                    <select
                      value={billingData.country}
                      onChange={(e) => setBillingData({ ...billingData, country: e.target.value })}
                      className={inputClass}
                    >
                      <option value="US">UNITED STATES</option>
                      <option value="CA">CANADA</option>
                      <option value="GB">UNITED KINGDOM</option>
                      <option value="NL">NETHERLANDS</option>
                      <option value="DE">GERMANY</option>
                    </select>
                  </div>
                  <button
                    onClick={() => setStep(2)}
                    className="w-full border border-foreground text-foreground bg-transparent py-3.5 rounded-lg font-medium uppercase tracking-widest text-xs hover:bg-foreground hover:text-background transition-all duration-300 inline-flex items-center justify-center gap-2 mt-4"
                  >
                    Select payment method <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Billing summary */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      <span className="text-xs uppercase tracking-wider text-foreground font-medium">Billing address</span>
                    </div>
                    <button
                      onClick={() => setStep(1)}
                      className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Edit information
                    </button>
                  </div>

                  <div>
                    <span className="font-serif italic text-2xl text-foreground">Payment</span>
                    <h3 className="text-lg font-bold uppercase tracking-wider text-foreground">Method</h3>
                  </div>

                  {/* Payment toggle */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPaymentMethod("card")}
                      className={`flex-1 py-3 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${
                        paymentMethod === "card"
                          ? "bg-foreground text-background"
                          : "bg-white/50 text-foreground hover:bg-white/70"
                      }`}
                    >
                      <CreditCard className="w-4 h-4 inline mr-2" />
                      Credit card
                    </button>
                    <button
                      onClick={() => setPaymentMethod("paypal")}
                      className={`flex-1 py-3 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${
                        paymentMethod === "paypal"
                          ? "bg-foreground text-background"
                          : "bg-white/50 text-foreground hover:bg-white/70"
                      }`}
                    >
                      PayPal
                    </button>
                  </div>

                  {paymentMethod === "card" && (
                    <div className="space-y-3">
                      <input type="text" placeholder="CARD NUMBER" className={inputClass} />
                      <div className="grid grid-cols-2 gap-3">
                        <input type="text" placeholder="MM / YY" className={inputClass} />
                        <input type="text" placeholder="CVC" className={inputClass} />
                      </div>
                      <input type="text" placeholder="CARDHOLDER NAME" className={inputClass} />
                    </div>
                  )}

                  {paymentMethod === "paypal" && (
                    <p className="text-xs text-muted-foreground tracking-wider uppercase">
                      You will be redirected to PayPal to complete your purchase.
                    </p>
                  )}

                  {/* Promo code */}
                  <div className="border-t border-foreground/10 pt-4 space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="PROMO CODE"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        className={`${inputClass} flex-1`}
                      />
                      <button className="text-[10px] uppercase tracking-widest text-foreground font-semibold whitespace-nowrap flex items-center gap-1 hover:text-muted-foreground transition-colors">
                        Add <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Gift card */}
                  <div className="border-t border-foreground/10 pt-4 space-y-3">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Gift card</p>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="CODE"
                        value={giftCode}
                        onChange={(e) => setGiftCode(e.target.value)}
                        className={inputClass}
                      />
                      <input
                        type="text"
                        placeholder="PIN"
                        value={giftPin}
                        onChange={(e) => setGiftPin(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <button className="text-[10px] uppercase tracking-widest text-foreground font-semibold flex items-center gap-1 hover:text-muted-foreground transition-colors">
                      Use gift card <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    onClick={() => setStep(3)}
                    className="w-full border border-foreground text-foreground bg-transparent py-3.5 rounded-lg font-medium uppercase tracking-widest text-xs hover:bg-foreground hover:text-background transition-all duration-300 inline-flex items-center justify-center gap-2 mt-2"
                  >
                    Complete purchase <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Sticky total at bottom */}
            <div className="border-t border-foreground/10 p-8 md:px-10 py-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground">Total</span>
                <span className="text-lg font-bold text-foreground">{item.price}{item.period || ""}</span>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CheckoutSheet;
