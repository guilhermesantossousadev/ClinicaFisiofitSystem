import { createContext, useContext, useState, type ReactNode } from "react";
import CheckoutSheet from "@/components/CheckoutSheet";
import BookingSheet from "@/components/BookingSheet";
import { type PricingItem } from "@/data/pricing";
import { packages } from "@/data/pricing";

export interface SessionMetadata {
  className: string;
  practitioner: string;
  date: string;
  time: string;
}

interface CheckoutContextType {
  openCheckout: (item?: PricingItem, session?: SessionMetadata) => void;
  openBooking: (editingId?: string | null, onBooked?: () => void) => void;
}

const CheckoutContext = createContext<CheckoutContextType>({ openCheckout: () => {}, openBooking: () => {} });

export const useCheckout = () => useContext(CheckoutContext);

export const CheckoutProvider = ({ children }: { children: ReactNode }) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PricingItem | null>(null);
  const [sessionMeta, setSessionMeta] = useState<SessionMetadata | null>(null);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [onBookedCallback, setOnBookedCallback] = useState<(() => void) | null>(null);

  const openCheckout = (item?: PricingItem, session?: SessionMetadata) => {
    setSelectedItem(item || packages[0]);
    setSessionMeta(session || null);
    setSheetOpen(true);
  };

  const openBooking = (editingId?: string | null, onBooked?: () => void) => {
    setEditingBookingId(editingId || null);
    setOnBookedCallback(() => onBooked || null);
    setBookingOpen(true);
  };

  return (
    <CheckoutContext.Provider value={{ openCheckout, openBooking }}>
      {children}
      <CheckoutSheet open={sheetOpen} onOpenChange={setSheetOpen} item={selectedItem} sessionMeta={sessionMeta} />
      <BookingSheet
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        editingBookingId={editingBookingId}
        onBooked={onBookedCallback || undefined}
      />
    </CheckoutContext.Provider>
  );
};
