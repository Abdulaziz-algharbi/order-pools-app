/**
 * Domain types for Order Pool.
 *
 * These model the concepts described in the product scope and are intentionally
 * shaped to be easy to swap for real backend response types later — the mock
 * data layer (`src/mocks`) is the only place that should need to change once a
 * real API is wired up.
 */

export type UserRole = "retailer" | "supplier" | "admin";

export interface BaseUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: UserRole;
  createdAt: string;
}

export interface RetailerUser extends BaseUser {
  role: "retailer";
  businessName: string;
  phone?: string;
  address?: string;
}

export interface SupplierUser extends BaseUser {
  role: "supplier";
  companyName: string;
  phone?: string;
  address?: string;
  verified: boolean;
}

export interface AdminUser extends BaseUser {
  role: "admin";
  title?: string;
}

export type AppUser = RetailerUser | SupplierUser | AdminUser;

/** Lifecycle status of a supplier offer awaiting/having received admin review. */
export type SupplierOfferStatus =
  | "pending_review"
  | "negotiation"
  | "accepted"
  | "refused";

export interface SupplierOffer {
  id: string;
  supplierId: string;
  supplierName: string;
  productName: string;
  productDescription: string;
  productImageUrl?: string;
  category: string;
  targetQuantity: number;
  unit: string;
  minContribution: number;
  unitPrice: number;
  proposedDeadline: string;
  status: SupplierOfferStatus;
  submittedAt: string;
  decidedAt?: string;
  adminNote?: string;
}

/** Lifecycle status of a pool once it exists (i.e. an accepted offer). */
export type PoolStatus =
  | "active"
  | "met"
  | "delivery_assigned"
  | "delivered"
  | "closed";

export interface Pool {
  id: string;
  offerId: string;
  supplierId: string;
  supplierName: string;
  productName: string;
  productDescription: string;
  productImageUrl?: string;
  category: string;
  targetQuantity: number;
  currentQuantity: number;
  unit: string;
  minContribution: number;
  unitPrice: number;
  startDate: string;
  deadline: string;
  status: PoolStatus;
  participantCount: number;
  delivery?: Delivery;
}

export interface PoolParticipant {
  poolId: string;
  retailerId: string;
  retailerName: string;
  quantity: number;
  joinedAt: string;
}

/** A retailer's participation record in a pool ("Join"). */
export interface Join {
  id: string;
  poolId: string;
  retailerId: string;
  quantity: number;
  totalPrice: number;
  joinedAt: string;
}

export type DeliveryStatus =
  | "preparing"
  | "assigned"
  | "in_transit"
  | "delivered";

export interface Delivery {
  id: string;
  poolId: string;
  status: DeliveryStatus;
  driverName?: string;
  driverPhone?: string;
  assignedAt?: string;
  estimatedArrival?: string;
  deliveredAt?: string;
  updates: DeliveryUpdate[];
}

export interface DeliveryUpdate {
  id: string;
  timestamp: string;
  message: string;
}

export type ComplaintStatus = "open" | "in_review" | "resolved" | "dismissed";

export interface Complaint {
  id: string;
  retailerId: string;
  retailerName: string;
  poolId?: string;
  subject: string;
  description: string;
  status: ComplaintStatus;
  createdAt: string;
  response?: string;
  respondedAt?: string;
}

export type NotificationType =
  | "pool_status"
  | "pool_met"
  | "delivery_update"
  | "system"
  | "offer_status";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

export type SupplierRequestStatus = "pending" | "approved" | "rejected";

export interface SupplierRequest {
  id: string;
  applicantName: string;
  applicantEmail: string;
  companyName: string;
  message: string;
  status: SupplierRequestStatus;
  submittedAt: string;
}
