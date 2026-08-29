import {
  Folder,
  Briefcase,
  Rocket,
  Home,
  Heart,
  BookOpen,
  Code,
  Palette,
  ShoppingCart,
  Plane,
  DollarSign,
  Users,
  type LucideIcon,
} from "lucide-react";

export const PROJECT_ICONS: { name: string; icon: LucideIcon }[] = [
  { name: "folder", icon: Folder },
  { name: "briefcase", icon: Briefcase },
  { name: "rocket", icon: Rocket },
  { name: "home", icon: Home },
  { name: "heart", icon: Heart },
  { name: "book-open", icon: BookOpen },
  { name: "code", icon: Code },
  { name: "palette", icon: Palette },
  { name: "shopping-cart", icon: ShoppingCart },
  { name: "plane", icon: Plane },
  { name: "dollar-sign", icon: DollarSign },
  { name: "users", icon: Users },
];

export function getProjectIcon(name: string | null): LucideIcon {
  return PROJECT_ICONS.find((i) => i.name === name)?.icon ?? Folder;
}
