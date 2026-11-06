import { Compass, ListMusic, Search, Telescope, Trophy, Users, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
  /** Shown in the mobile tab bar (space for four + "You"). */
  mobile?: boolean;
};

/**
 * Primary navigation. Items are added here as each product area ships (see
 * DEVELOPMENT_STATUS.md) so the shell never links to unfinished pages.
 */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Discover", icon: Compass, match: (p) => p === "/", mobile: true },
  { href: "/explore", label: "Explore", icon: Telescope, match: (p) => p.startsWith("/explore"), mobile: true },
  { href: "/charts", label: "Charts", icon: Trophy, match: (p) => p.startsWith("/charts") },
  {
    href: "/search",
    label: "Search",
    icon: Search,
    match: (p) => p.startsWith("/search") || p.startsWith("/album/") || p.startsWith("/artist/"),
    mobile: true,
  },
  {
    href: "/lists",
    label: "Lists",
    icon: ListMusic,
    match: (p) => p.startsWith("/lists") || p.startsWith("/list/"),
    mobile: true,
  },
  {
    href: "/members",
    label: "Listeners",
    icon: Users,
    match: (p) => p.startsWith("/members") || p.startsWith("/user/"),
  },
];
