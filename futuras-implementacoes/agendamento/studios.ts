export interface Studio {
  id: number;
  slug: string;
  name: string;
  address: string;
  hours: string;
  status: string;
  imageDesc: string;
  phone: string;
  email: string;
  description: string;
  amenities: string[];
  classes: { name: string; time: string; practitioner: string }[];
  lat: number;
  lng: number;
}

export const studio: Studio = {
  id: 1,
  slug: "downtown-core",
  name: "Seattle Downtown Core",
  address: "1425 4th Avenue, Suite 200",
  hours: "05:30 – 21:00",
  status: "Open now",
  imageDesc: "Bright, airy studio with floor-to-ceiling windows, natural wood floors, sage green accents",
  phone: "(206) 555-0101",
  email: "hello@thrivewellness.co",
  description: "Our flagship studio in the heart of downtown Seattle. With 3,200 square feet of practice space, floor-to-ceiling windows offering stunning city views, and state-of-the-art equipment.",
  amenities: ["Heated studio room", "Shower & locker rooms", "Complimentary towel service", "Filtered water station", "Retail boutique", "Underground parking validation"],
  classes: [
    { name: "Morning Vinyasa Flow", time: "06:00 AM", practitioner: "Maya Chen" },
    { name: "Pilates Reformer", time: "10:00 AM", practitioner: "Sofia Martinez" },
    { name: "HIIT & Strength", time: "05:30 PM", practitioner: "Jordan Williams" },
  ],
  lat: 47.6101,
  lng: -122.3381,
};

// Keep backward compat
export const studios = [studio];
