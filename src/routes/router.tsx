import { createBrowserRouter } from "react-router-dom";
import { RootRedirect } from "@/routes/RootRedirect";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { LoginPage } from "@/pages/auth/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { NotificationsPage } from "@/pages/shared/NotificationsPage";
import { PaymentResultPage } from "@/pages/shared/PaymentResultPage";

import { RetailerDashboard } from "@/pages/retailer/RetailerDashboard";
import { PoolsBrowsePage } from "@/pages/retailer/PoolsBrowsePage";
import { PoolDetailPage } from "@/pages/retailer/PoolDetailPage";
import { MyJoinsPage } from "@/pages/retailer/MyJoinsPage";
import { TrackDeliveryPage } from "@/pages/retailer/TrackDeliveryPage";
import { ComplaintsPage } from "@/pages/retailer/ComplaintsPage";
import { RetailerProfilePage } from "@/pages/retailer/RetailerProfilePage";

import { SupplierDashboard } from "@/pages/supplier/SupplierDashboard";
import { SupplierPoolsPage } from "@/pages/supplier/SupplierPoolsPage";
import { SupplierPoolDetailPage } from "@/pages/supplier/SupplierPoolDetailPage";
import { SupplierOffersPage } from "@/pages/supplier/SupplierOffersPage";
import { SupplierOfferDetailPage } from "@/pages/supplier/SupplierOfferDetailPage";
import { CreateOfferPage } from "@/pages/supplier/CreateOfferPage";
import { SupplierPoolHistoryPage } from "@/pages/supplier/SupplierPoolHistoryPage";
import { SupplierProfilePage } from "@/pages/supplier/SupplierProfilePage";

import { AdminDashboard } from "@/pages/admin/AdminDashboard";
import { AdminOffersPage } from "@/pages/admin/AdminOffersPage";
import { AdminOffersHistoryPage } from "@/pages/admin/AdminOffersHistoryPage";
import { AdminActivePoolsPage } from "@/pages/admin/AdminActivePoolsPage";
import { AdminMetPoolsPage } from "@/pages/admin/AdminMetPoolsPage";
import { AdminPoolHistoryPage } from "@/pages/admin/AdminPoolHistoryPage";
import { AdminPoolDetailPage } from "@/pages/admin/AdminPoolDetailPage";
import { AdminTrackPoolsPage } from "@/pages/admin/AdminTrackPoolsPage";
import { AdminComplaintsPage } from "@/pages/admin/AdminComplaintsPage";
import { AdminSuppliersPage } from "@/pages/admin/AdminSuppliersPage";
import { AdminRetailersPage } from "@/pages/admin/AdminRetailersPage";

export const router = createBrowserRouter([
  { path: "/", element: <RootRedirect /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/payments/:paymentId/result", element: <PaymentResultPage /> },

  {
    path: "/retailer",
    element: <ProtectedRoute role="retailer" />,
    children: [
      { index: true, element: <RetailerDashboard />, handle: { title: "Dashboard" } },
      { path: "pools", element: <PoolsBrowsePage />, handle: { title: "Browse Pools" } },
      { path: "pools/:poolId", element: <PoolDetailPage />, handle: { title: "Pool Details" } },
      { path: "joins", element: <MyJoinsPage />, handle: { title: "My Joins" } },
      { path: "track", element: <TrackDeliveryPage />, handle: { title: "Track Deliveries" } },
      { path: "complaints", element: <ComplaintsPage />, handle: { title: "Complaints" } },
      { path: "notifications", element: <NotificationsPage />, handle: { title: "Notifications" } },
      { path: "profile", element: <RetailerProfilePage />, handle: { title: "Profile" } },
    ],
  },

  {
    path: "/supplier",
    element: <ProtectedRoute role="supplier" />,
    children: [
      { index: true, element: <SupplierDashboard />, handle: { title: "Dashboard" } },
      { path: "pools", element: <SupplierPoolsPage />, handle: { title: "Active Pools" } },
      { path: "pools/:poolId", element: <SupplierPoolDetailPage />, handle: { title: "Pool Details" } },
      { path: "offers", element: <SupplierOffersPage />, handle: { title: "Offers" } },
      { path: "offers/new", element: <CreateOfferPage />, handle: { title: "New Offer" } },
      { path: "offers/:offerId", element: <SupplierOfferDetailPage />, handle: { title: "Offer Details" } },
      { path: "history", element: <SupplierPoolHistoryPage />, handle: { title: "Pool History" } },
      { path: "notifications", element: <NotificationsPage />, handle: { title: "Notifications" } },
      { path: "profile", element: <SupplierProfilePage />, handle: { title: "Profile" } },
    ],
  },

  {
    path: "/admin",
    element: <ProtectedRoute role="admin" />,
    children: [
      { index: true, element: <AdminDashboard />, handle: { title: "Dashboard" } },
      { path: "offers", element: <AdminOffersPage />, handle: { title: "Supplier Offers" } },
      { path: "offers-history", element: <AdminOffersHistoryPage />, handle: { title: "Offers History" } },
      { path: "pools", element: <AdminActivePoolsPage />, handle: { title: "Active Pools" } },
      { path: "pools/:poolId", element: <AdminPoolDetailPage />, handle: { title: "Pool Details" } },
      { path: "met-pools", element: <AdminMetPoolsPage />, handle: { title: "Met Pools" } },
      { path: "pool-history", element: <AdminPoolHistoryPage />, handle: { title: "Pool History" } },
      { path: "track", element: <AdminTrackPoolsPage />, handle: { title: "Track Pools" } },
      { path: "complaints", element: <AdminComplaintsPage />, handle: { title: "Complaints" } },
      { path: "suppliers", element: <AdminSuppliersPage />, handle: { title: "Suppliers" } },
      { path: "retailers", element: <AdminRetailersPage />, handle: { title: "Retailers" } },
    ],
  },

  { path: "*", element: <NotFoundPage /> },
]);
