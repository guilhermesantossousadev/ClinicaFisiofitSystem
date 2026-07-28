import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Booking {
  id: string;
  class_name: string;
  practitioner: string;
  date: string;
  time: string;
}

interface CancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking | null;
  onCancelled: () => void;
}

const CancelDialog = ({ open, onOpenChange, booking, onCancelled }: CancelDialogProps) => {
  const [loading, setLoading] = useState(false);

  if (!booking) return null;

  const formatTime = (time: string) => {
    const [h, m] = time.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${h12}:${m} ${ampm}`;
  };

  const handleCancel = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", booking.id);

    if (error) {
      toast.error("Failed to cancel session");
    } else {
      toast.success("Session cancelled");
      onCancelled();
    }
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-background border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-bold uppercase tracking-wider text-foreground text-sm">
            Cancel this session?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-muted-foreground">
            <p className="text-xs uppercase tracking-wider font-semibold text-foreground">{booking.class_name}</p>
            <p className="text-xs uppercase tracking-wider">
              {format(parseISO(booking.date), "EEEE d MMMM")} · {formatTime(booking.time)}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-col gap-2">
          <button
            onClick={handleCancel}
            disabled={loading}
            className="w-full border border-destructive text-destructive bg-transparent py-3 rounded-lg font-medium uppercase tracking-widest text-xs hover:bg-destructive hover:text-destructive-foreground transition-all duration-300 disabled:opacity-50"
          >
            {loading ? "Cancelling..." : "Yes, cancel session"}
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className="w-full border border-foreground text-foreground bg-transparent py-3 rounded-lg font-medium uppercase tracking-widest text-xs hover:bg-foreground hover:text-background transition-all duration-300"
          >
            Keep session
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default CancelDialog;
