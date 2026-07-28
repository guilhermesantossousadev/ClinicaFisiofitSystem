export interface Practitioner {
  id: number;
  name: string;
  slug: string;
  style: string;
  specialty: string;
  imageDesc: string;
  bio1?: string;
  bio2?: string;
  additionalNote?: string;
}

export const practitioners: Practitioner[] = [
  { id: 1, name: "Maya Chen", slug: "maya-chen", style: "Mindful", specialty: "Yoga & Meditation", imageDesc: "Woman with serene expression in sage green wellness attire sitting in meditation pose outdoors", bio1: "Whether she's hiking mountain trails, teaching transformative classes, or savoring a slow morning with tea and journaling, Maya lives with intentional presence. This naturally introverted guide has found her calling on the mat, creating sacred space where students discover their own inner wisdom. She makes each session about authentic connection, deep listening, and gentle transformation.", bio2: "Maya believes movement is medicine and stillness is power. Her teaching weaves ancient yogic wisdom with modern neuroscience, creating practices that calm the nervous system while building sustainable strength. She loves world music, nature sounds, and ambient electronica – anything that supports the journey inward. Her classes guide you through mindful flows, into restorative holds, and closer to your most centered self. Don't miss the chance to practice with Maya and discover what becomes possible when you truly arrive in your body.", additionalNote: "Certified in trauma-informed yoga and meditation" },
  { id: 2, name: "Jordan Williams", slug: "jordan-williams", style: "Energetic", specialty: "HIIT & Strength", imageDesc: "Athletic person in coral activewear demonstrating dynamic exercise pose" },
  { id: 3, name: "Sofia Martinez", slug: "sofia-martinez", style: "Nurturing", specialty: "Pilates & Barre", imageDesc: "Woman with warm smile in terracotta fitted athletic wear showing graceful posture" },
];
