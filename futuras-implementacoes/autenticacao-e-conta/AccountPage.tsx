import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, DollarSign, LogOut, MapPin, Pencil, RefreshCw, X } from "lucide-react";
import Layout from "@/components/Layout";
import SessionDetailSheet from "@/components/SessionDetailSheet";
import CancelDialog from "@/components/CancelDialog";
import { useCheckout } from "@/contexts/CheckoutContext";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, isToday, isFuture, isPast } from "date-fns";

interface Booking {
  id: string;
  class_name: string;
  practitioner: string;
  date: string;
  time: string;
  location: string;
  status: string;
}

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning,";
  if (h < 18) return "Good afternoon,";
  return "Good evening,";
};

const formatTime = (time: string) => {
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
};

const AccountPage = () => {
  const navigate = useNavigate();
  const { openBooking } = useCheckout();
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);

  const fetchBookings = useCallback(async () => {
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("status", "confirmed")
      .order("date", { ascending: true });
    setBookings((data as Booking[]) || []);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        navigate("/login");
        return;
      }
      setUser({ email: u.email || "" });
      setLoading(false);
    };
    checkAuth();
    fetchBookings();
  }, [navigate, fetchBookings]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) return <Layout><div className="min-h-screen" /></Layout>;

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "??";
  const name = user?.email?.split("@")[0] || "there";

  const now = new Date();
  const upcoming = bookings.filter((b) => {
    const d = parseISO(b.date);
    return isFuture(d) || isToday(d);
  });
  const past = bookings.filter((b) => isPast(parseISO(b.date)) && !isToday(b.date));

  return (
    <Layout>
      <section className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
          <div className="grid md:grid-cols-12 gap-10">
            {/* Sidebar */}
            <div className="md:col-span-4 lg:col-span-3 space-y-8">
              <div className="flex items-center gap-4 md:flex-col md:items-start">
                <div className="w-16 h-16 rounded-full bg-foreground text-background flex items-center justify-center text-lg font-bold shrink-0">
                  {initials}
                </div>
                <div>
                  <p className="font-serif italic text-2xl text-foreground">{getGreeting()}</p>
                  <h1 className="text-lg font-bold uppercase tracking-wider text-foreground">{name}</h1>
                </div>
              </div>

              <div className="space-y-2">
                <button className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium flex items-center gap-2 py-1 hover:text-foreground transition-colors">
                  <Pencil className="w-3 h-3" /> Edit profile
                </button>
                <button className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium flex items-center gap-2 py-1 hover:text-foreground transition-colors">
                  <Pencil className="w-3 h-3" /> Manage cards
                </button>
              </div>

              <div className="border-t border-border pt-6 space-y-5">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Level</p>
                  <p className="text-sm font-bold uppercase tracking-wider text-foreground mt-1">100 Sessions</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Sessions</p>
                  <p className="text-2xl font-bold text-foreground">{bookings.length}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Referrals</p>
                  <p className="text-2xl font-bold text-foreground">0</p>
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <button
                  onClick={handleLogout}
                  className="border border-foreground text-foreground bg-transparent py-2.5 px-5 rounded-lg font-medium uppercase tracking-widest text-[10px] hover:bg-foreground hover:text-background transition-all duration-300 inline-flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" /> Log out <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Main */}
            <div className="md:col-span-8 lg:col-span-9 space-y-12">
              {/* Upcoming */}
              <div>
                <div className="mb-6">
                  <span className="font-serif italic text-2xl text-foreground">Upcoming</span>
                  <h2 className="text-lg font-bold uppercase tracking-wider text-foreground">Sessions</h2>
                </div>
                <div className="space-y-3">
                  {upcoming.length === 0 && (
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">No upcoming sessions</p>
                  )}
                  {upcoming.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => { setSelectedBooking(b); setDetailOpen(true); }}
                      className="w-full bg-card rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 text-left hover:bg-muted/50 transition-all"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                        {b.practitioner.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wider text-foreground">{b.class_name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                          {b.practitioner} · {format(parseISO(b.date), "EEE d MMM")} · {formatTime(b.time)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-[10px] uppercase tracking-widest bg-muted text-foreground px-3 py-1 rounded-full font-medium flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Downtown
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setCancelTarget(b); setCancelOpen(true); }}
                          className="text-[10px] uppercase tracking-widest text-destructive px-3 py-1 rounded-full font-medium border border-destructive/30 hover:bg-destructive hover:text-destructive-foreground transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={() => openBooking(null, fetchBookings)}
                    className="w-full border border-dashed border-foreground/30 rounded-xl py-4 text-xs font-medium uppercase tracking-widest text-foreground hover:bg-muted/30 transition-all flex items-center justify-center gap-2"
                  >
                    + Book a new session <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Past */}
              {past.length > 0 && (
                <div>
                  <div className="mb-6">
                    <span className="font-serif italic text-2xl text-foreground">Past</span>
                    <h2 className="text-lg font-bold uppercase tracking-wider text-foreground">Sessions</h2>
                  </div>
                  <div className="space-y-3">
                    {past.map((b) => (
                      <div key={b.id} className="bg-card rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 opacity-70">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                          {b.practitioner.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wider text-foreground">{b.class_name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                            {b.practitioner} · {format(parseISO(b.date), "EEE d MMM")} · {formatTime(b.time)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-[10px] uppercase tracking-widest text-primary px-3 py-1 rounded-full font-medium flex items-center gap-1">
                            <Check className="w-3 h-3" /> Attended
                          </span>
                          <button
                            onClick={() => openBooking(null, fetchBookings)}
                            className="text-[10px] uppercase tracking-widest text-foreground px-3 py-1 rounded-full font-medium border border-foreground/30 hover:bg-foreground hover:text-background transition-all"
                          >
                            Book again
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dashboard */}
              <div>
                <div className="mb-6">
                  <span className="font-serif italic text-2xl text-foreground">Your</span>
                  <h2 className="text-lg font-bold uppercase tracking-wider text-foreground">Dashboard</h2>
                </div>
                <div className="space-y-4">
                  {/* Memberships */}
                  <div className="bg-card rounded-xl p-6 space-y-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Memberships</p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <RefreshCw className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-foreground">Automatic renewal</p>
                          <p className="text-[10px] text-muted-foreground">every 28 days</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <X className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-foreground">Cancel anytime</p>
                          <p className="text-[10px] text-muted-foreground">easily from your account</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <DollarSign className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-foreground">Get the best deal</p>
                          <p className="text-[10px] text-muted-foreground">book at the best price per session</p>
                        </div>
                      </div>
                    </div>
                    <Link
                      to="/pricing"
                      className="border border-foreground text-foreground bg-transparent py-2.5 px-5 rounded-lg font-medium uppercase tracking-widest text-[10px] hover:bg-foreground hover:text-background transition-all duration-300 inline-flex items-center gap-2"
                    >
                      Become a member <ArrowRight className="w-3 h-3" />
                    </Link>
                    <p className="text-[10px] text-muted-foreground">
                      Want to know more? <Link to="/faq" className="underline hover:text-foreground transition-colors">Read our memberships FAQ</Link>
                    </p>
                  </div>

                  {/* Series */}
                  <div className="bg-card rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-foreground">No series</p>
                    <Link
                      to="/pricing"
                      className="border border-foreground text-foreground bg-transparent py-2.5 px-5 rounded-lg font-medium uppercase tracking-widest text-[10px] hover:bg-foreground hover:text-background transition-all duration-300 inline-flex items-center gap-2 shrink-0"
                    >
                      Buy series <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SessionDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        booking={selectedBooking}
        onReschedule={(id) => openBooking(id, fetchBookings)}
        onCancel={(b) => { setCancelTarget(b); setCancelOpen(true); }}
      />
      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        booking={cancelTarget}
        onCancelled={fetchBookings}
      />
    </Layout>
  );
};

export default AccountPage;
