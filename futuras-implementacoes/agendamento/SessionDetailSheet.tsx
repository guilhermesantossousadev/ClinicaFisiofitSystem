import { ArrowRight, MapPin, X } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { format, parseISO } from "date-fns";

interface Booking {
  id: string;
  class_name: string;
  practitioner: string;
  date: string;
  time: string;
  location: string;
  status: string;
}

interface SessionDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking | null;
  onReschedule: (bookingId: string) => void;
  onCancel: (booking: Booking) => void;
}

const SessionDetailSheet = ({ open, onOpenChange, booking, onReschedule, onCancel }: SessionDetailSheetProps) => {
  if (!booking) return null;

  const formatTime = (time: string) => {
    const [h, m] = time.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${h12}:${m} ${ampm}`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[50vw] p-0 border-0 [&>button]:hidden bg-gradient-to-b from-muted/30 via-background to-background">
        <div className="h-full flex flex-col p-8 md:p-10">
          <div className="flex justify-end mb-8">
            <button onClick={() => onOpenChange(false)} className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="Close">
              <X className="w-5 h-5 text-foreground" />
            </button>
          </div>

          <div className="space-y-8 flex-1 flex flex-col">
            <div>
              <span className="font-serif italic text-3xl text-foreground">Session</span>
              <h2 className="text-xl font-bold uppercase tracking-wider text-foreground">Details</h2>
            </div>

            <div className="bg-card rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-foreground">
                  {booking.practitioner.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-foreground">{booking.class_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{booking.practitioner}</p>
                </div>
              </div>
              <div className="border-t border-border pt-4 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  {format(parseISO(booking.date), "EEEE d MMMM")} · {formatTime(booking.time)}
                </p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {booking.location}
                </p>
              </div>
            </div>

            <div className="mt-auto space-y-3">
              <button
                onClick={() => { onOpenChange(false); onReschedule(booking.id); }}
                className="w-full border border-foreground text-foreground bg-transparent py-3.5 rounded-lg font-medium uppercase tracking-widest text-xs hover:bg-foreground hover:text-background transition-all duration-300 inline-flex items-center justify-center gap-2"
              >
                Reschedule <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { onOpenChange(false); onCancel(booking); }}
                className="w-full border border-destructive text-destructive bg-transparent py-3.5 rounded-lg font-medium uppercase tracking-widest text-xs hover:bg-destructive hover:text-destructive-foreground transition-all duration-300 inline-flex items-center justify-center"
              >
                Cancel session
              </button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SessionDetailSheet;
