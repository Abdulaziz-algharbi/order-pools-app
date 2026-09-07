import type { ComponentType } from "react";
import type { Panel } from "@/lib/panel";
import {
  AlertIcon,
  BellIcon,
  BuildingIcon,
  ClockHistoryIcon,
  HomeIcon,
  LayersIcon,
  ListIcon,
  MapPinIcon,
  PackageIcon,
  PlusIcon,
  TruckIcon,
  UserIcon,
  UsersIcon,
} from "@/components/ui/icons";

export interface NavItem {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
}

export const NAV_ITEMS: Record<Panel, NavItem[]> = {
  retailer: [
    { label: "Dashboard", to: "/retailer", icon: HomeIcon, end: true },
    { label: "Browse Pools", to: "/retailer/pools", icon: PackageIcon },
    { label: "My Joins", to: "/retailer/joins", icon: LayersIcon },
    { label: "Track Deliveries", to: "/retailer/track", icon: TruckIcon },
    { label: "Complaints", to: "/retailer/complaints", icon: AlertIcon },
    { label: "Notifications", to: "/retailer/notifications", icon: BellIcon },
    { label: "Profile", to: "/retailer/profile", icon: UserIcon },
  ],
  supplier: [
    { label: "Dashboard", to: "/supplier", icon: HomeIcon, end: true },
    { label: "Active Pools", to: "/supplier/pools", icon: PackageIcon },
    { label: "Offers", to: "/supplier/offers", icon: ListIcon },
    { label: "Pool History", to: "/supplier/history", icon: ClockHistoryIcon },
    { label: "Notifications", to: "/supplier/notifications", icon: BellIcon },
    { label: "Profile", to: "/supplier/profile", icon: UserIcon },
  ],
  admin: [
    { label: "Dashboard", to: "/admin", icon: HomeIcon, end: true },
    { label: "Supplier Offers", to: "/admin/offers", icon: ListIcon },
    { label: "Offers History", to: "/admin/offers-history", icon: ClockHistoryIcon },
    { label: "Active Pools", to: "/admin/pools", icon: PackageIcon },
    { label: "Met Pools", to: "/admin/met-pools", icon: LayersIcon },
    { label: "Pool History", to: "/admin/pool-history", icon: ClockHistoryIcon },
    { label: "Track Pools", to: "/admin/track", icon: MapPinIcon },
    { label: "Complaints", to: "/admin/complaints", icon: AlertIcon },
    { label: "Suppliers", to: "/admin/suppliers", icon: BuildingIcon },
    { label: "Retailers", to: "/admin/retailers", icon: UsersIcon },
  ],
};

export const CREATE_OFFER_ITEM: NavItem = {
  label: "New Offer",
  to: "/supplier/offers/new",
  icon: PlusIcon,
};
