import { useState, useMemo } from "react";
import { ArrowLeft, ArrowRight, MapPin, X } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { studio } from "@/data/studios";
import { supabase } from "@/integrations/supabase/client";
import { useCheckout } from "@/contexts/CheckoutContext";
import { toast } from "sonner";
import { format, addDays, isSameDay } from "date-fns";

interface BookingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingBookingId?: string | null;
  onBooked?: () => void;
}

const BookingSheet = ({ open, onOpenChange, editingBookingId, onBooked }: BookingSheetProps) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedClass, setSelectedClass] = useState<typeof studio.classes[0] | null>(null);
  const [loading, setLoading] = useState(false);
  const { openCheckout } = useCheckout();

  const dates = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => addDays(today, i));
  }, []);

  const resetAndClose = () => {
    setStep(1);
    setSelectedClass(null);
    onOpenChange(false);
  };

  const handleSelectClass = (cls: typeof studio.classes[0]) => {
    setSelectedClass(cls);
    setStep(2);
  };

  const handleConfirmBooking = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Not logged in — open checkout with session data
      resetAndClose();
      openCheckout(undefined, {
        className: selectedClass!.name,
        practitioner: selectedClass!.practitioner,
        date: format(selectedDate, "yyyy-MM-dd"),
        time: selectedClass!.time,
      });
      return;
    }

    // Parse time string to 24h format for DB
    const timeParts = selectedClass!.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
    let hours = parseInt(timeParts![1]);
    const mins = timeParts![2];
    const ampm = timeParts![3].toUpperCase();
    if (ampm === "PM" && hours !== 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    const timeStr = `${hours.toString().padStart(2, "0")}:${mins}:00`;

    if (editingBookingId) {
      const { error } = await supabase
        .from("bookings")
        .update({
          class_name: selectedClass!.name,
          practitioner: selectedClass!.practitioner,
          date: format(selectedDate, "yyyy-MM-dd"),
          time: timeStr,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingBookingId);

      if (error) {
        toast.error("Failed to reschedule session");
      } else {
        toast.success("Session rescheduled!");
        onBooked?.();
      }
    } else {
      const { error } = await supabase.from("bookings").insert({
        user_id: user.id,
        class_name: selectedClass!.name,
        practitioner: selectedClass!.practitioner,
        date: format(selectedDate, "yyyy-MM-dd"),
        time: timeStr,
        location: studio.name,
      });

      if (error) {
        toast.error("Failed to book session");
      } else {
        toast.success("Session booked!");
        onBooked?.();
      }
    }

    setLoading(false);
    resetAndClose();
  };

  return (
    <Sheet open={open} onOpenChange={resetAndClose}>
      <SheetContent side="right" className="w-full sm:max-w-[50vw] p-0 border-0 [&>button]:hidden bg-gradient-to-b from-muted/30 via-background to-background">
        <div className="h-full flex flex-col p-8 md:p-10 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            {step === 2 ? (
              <button onClick={() => setStep(1)} className="flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            ) : (
              <div />
            )}
            <button onClick={resetAndClose} className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="Close">
              <X className="w-5 h-5 text-foreground" />
            </button>
          </div>

          {step === 1 ? (
            <div className="space-y-8 flex-1">
              {/* Title */}
              <div>
                <span className="font-serif italic text-3xl text-foreground">Select a</span>
                <h2 className="text-xl font-bold uppercase tracking-wider text-foreground">Date & Session</h2>
              </div>

              {/* Date strip */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {dates.map((date) => {
                  const isSelected = isSameDay(date, selectedDate);
                  const isToday = isSameDay(date, new Date());
                  return (
                    <button
                      key={date.toISOString()}
                      onClick={() => setSelectedDate(date)}
                      className={`flex flex-col items-center shrink-0 py-3 px-4 rounded-xl transition-all text-center ${
                        isSelected
                          ? "bg-foreground text-background"
                          : "bg-card hover:bg-muted text-foreground"
                      }`}
                    >
                      <span className="text-[10px] uppercase tracking-widest font-medium">
                        {isToday ? "Today" : format(date, "EEE")}
                      </span>
                      <span className="text-lg font-bold">{format(date, "d")}</span>
                      <span className="text-[10px] uppercase tracking-widest">{format(date, "MMM")}</span>
                    </button>
                  );
                })}
              </div>

              {/* Sessions list */}
              <div className="space-y-3">
                {studio.classes.map((cls) => (
                  <button
                    key={cls.name}
                    onClick={() => handleSelectClass(cls)}
                    className="w-full bg-card rounded-xl p-5 flex items-center gap-4 hover:bg-muted/50 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                      {cls.practitioner.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-foreground">{cls.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                        {cls.practitioner} · {cls.time}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Downtown
                      </span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8 flex-1 flex flex-col">
              {/* Title */}
              <div>
                <span className="font-serif italic text-3xl text-foreground">Confirm</span>
                <h2 className="text-xl font-bold uppercase tracking-wider text-foreground">Session</h2>
              </div>

              {/* Session details */}
              <div className="bg-card rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-foreground">
                    {selectedClass?.practitioner.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wider text-foreground">{selectedClass?.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">with {selectedClass?.practitioner}</p>
                  </div>
                </div>
                <div className="border-t border-border pt-4 space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    {format(selectedDate, "EEEE d MMMM")} · {selectedClass?.time}
                  </p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {studio.name} · 60 min
                  </p>
                </div>
                <div className="border-t border-border pt-4 flex justify-between">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Drop-in session</span>
                  <span className="text-sm font-bold text-foreground">$35.00</span>
                </div>
              </div>

              <div className="mt-auto space-y-3">
                <button
                  onClick={handleConfirmBooking}
                  disabled={loading}
                  className="w-full border border-foreground text-foreground bg-transparent py-3.5 rounded-lg font-medium uppercase tracking-widest text-xs hover:bg-foreground hover:text-background transition-all duration-300 inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? "Processing..." : editingBookingId ? "Confirm reschedule" : "Confirm booking"}
                  {!loading && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default BookingSheet;
