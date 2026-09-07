/**
 * Domain types for Order Pool.
 *
 * These mirror the JSON the backend actually returns (see
 * order-pools-backend `src/services/*`), not its internal Mongoose
 * schemas — field names, id shape (`_id`, Mongo-style), and enum casing
 * (backend enums are UPPER_SNAKE) all match the wire format exactly so
 * there's no silent renaming to keep in sync by hand. Fields the backend
 * never populates (e.g. `*_ref` ids) are kept as bare id strings; entities
 * that need related data fetch it via a separate call.
 */

// Embedded in both JWTs and `User.roles` — an account can hold more than
// one (e.g. an approved supplier request adds SUPPLIER onto an existing
// RETAILER without removing it).
export type UserRole = "RETAILER" | "SUPPLIER" | "ADMIN";

export type UserStatus = "ACTIVE" | "SUSPENDED" | "PENDING";

/**
 * A single flat shape for every account — the backend's `User` model has
 * no role-specific fields (no separate "business name" vs "company name",
 * no per-role verification flag), so there's nothing to discriminate on.
 */
export interface AppUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  companyName: string;
  roles: UserRole[];
  commercialRegistration?: string | null;
  vatNumber?: string | null;
  /** Address ids. `GET /users/:_id` (admin-only) returns these populated as `Address[]` instead. */
  addresses: string[];
  profileImage?: string | null;
  isVerified?: boolean;
  status?: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  _id: string;
  location: string;
  region: string;
  city: string;
  street?: string | null;
}

export type ProductOfferUnit = "PIECE" | "KG" | "BOX" | "CARTON";
export type ProductOfferStatus =
  | "PENDING"
  | "NEGOTIATION"
  | "APPROVED"
  | "REJECTED";

/**
 * A supplier's wholesale listing under admin review. Only visible to its
 * owning SUPPLIER and ADMIN — a RETAILER never sees this directly (see
 * `Pool`'s snapshotted display fields).
 */
export interface ProductOffer {
  _id: string;
  user_ref: string;
  name: string;
  description: string;
  brand?: string | null;
  unit: ProductOfferUnit;
  images?: string | null;
  wholeQuantity: number;
  price: number;
  status: ProductOfferStatus;
  adminComment?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PoolStatus =
  | "OPEN"
  | "TARGET_REACHED"
  | "DISTRIBUTING"
  | "COMPLETED"
  | "CANCELLED";

export type SupplierPaymentStatus = "NOT_PAID" | "PAID";

/**
 * A pool is only ever created (by an admin) from an APPROVED
 * `ProductOffer`. Its display fields (`productName`, `productDescription`,
 * `productImageUrl`, `unit`, `supplierName`) are snapshotted from that
 * offer at creation time — a retailer has no read access to `ProductOffer`
 * itself, so this is the only place that data reaches them.
 *
 * `currentQuantity` counts DOWN from `targetQuantity` as participants
 * join (it's the amount still claimable, not the amount collected so
 * far) — render collected progress as `targetQuantity - currentQuantity`.
 */
export interface Pool {
  _id: string;
  productoffer_ref: string;
  productName: string;
  productDescription: string;
  productImageUrl?: string | null;
  unit: ProductOfferUnit;
  supplierName?: string | null;
  targetQuantity: number;
  currentQuantity: number;
  minimumContribution: number;
  pricePerUnit: number;
  startDate: string;
  endDate: string;
  status: PoolStatus;
  supplierPaymentStatus: SupplierPaymentStatus;
  /** Count of participants with a live or completed claim (excludes failed/refunded joins). */
  participantCount: number;
  createdAt: string;
  updatedAt: string;
}

export type PoolParticipantStatus =
  | "PENDING_PAYMENT"
  | "WAITING"
  | "PAYMENT_FAILED"
  | "REFUNDED"
  | "DELIVERED";

/** A retailer's claim on a pool's quantity — created by `POST /participants` (the "join a pool" action). */
export interface PoolParticipant {
  _id: string;
  user_ref: string;
  pool_ref: string;
  payment_ref: string;
  address_ref: string;
  quantity: number;
  status: PoolParticipantStatus;
  createdAt: string;
  updatedAt: string;
}

export type PaymentStatus =
  | "PENDING"
  | "COMPLETED"
  | "FAILED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "REFUND_FAILED";

/** A Thawani-backed checkout for one participant's contribution. */
export interface Payment {
  _id: string;
  pool_ref: string;
  poolParticipant_ref: string;
  user_ref: string;
  amount: number;
  currency: "OMR";
  thawaniSessionId: string;
  thawaniPaymentId?: string | null;
  thawaniRefundId?: string | null;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export type SupplierPayoutStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

/** A manual bank transfer to a supplier for a completed pool's delivery — auto-created once delivery completes. */
export interface SupplierPayout {
  _id: string;
  pool_ref: string;
  amount: number;
  status: SupplierPayoutStatus;
  transactionReference?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReviewRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

/** A retailer's request to also become a supplier. Approval `$addToSet`s SUPPLIER onto the user's roles. */
export interface SupplierRequest {
  _id: string;
  user_ref: string;
  description: string;
  status: ReviewRequestStatus;
  adminComment?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A supplier's request to close their account — created as a side effect of `DELETE /auth/remove`, never posted directly. */
export interface SupplierRemoveRequest {
  _id: string;
  user_ref: string;
  reason: string;
  status: ReviewRequestStatus;
  adminComment?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DeliveryStatus = "PENDING" | "DELIVERING" | "DELIVERED";

export interface Delivery {
  _id: string;
  pool_ref: string;
  deliveryStatus: DeliveryStatus;
  /** Backend default is the literal string `"Not Set"` until actually delivered — don't assume this always parses as a date. */
  deliveredAt: string | null;
}

export type ComplaintPriority = "LOW" | "MEDIUM" | "HIGH";
export type ComplaintStatus = "OPEN" | "UNDER REVIEW" | "RESOLVED";

/** No timestamps on this resource server-side (no `createdAt`/`updatedAt`), and no DELETE route exists for it. */
export interface Complaint {
  _id: string;
  creator_ref: string;
  pool_ref: string;
  title: string;
  description: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  resolution?: string;
}

export type NotificationType =
  | "DELIVERY_ASSIGNED"
  | "PAYMENT_COMPLETED"
  | "PAYMENT_FAILED"
  | "PAYMENT_REFUNDED";

export type NotificationPriority = "LOW" | "NORMAL" | "HIGH";

export interface NotificationRecipient {
  user_ref: string;
  isRead: boolean;
  readAt?: string | null;
}

/**
 * Mostly system-generated (delivery/payment events), not posted by users.
 * A non-admin caller only ever sees `recipients` redacted down to their
 * own entry — the backend never exposes other recipients or their read
 * state to them.
 */
export interface AppNotification {
  _id: string;
  sender_ref?: string | null;
  recipients: NotificationRecipient[];
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string | null;
  priority: NotificationPriority;
  createdAt: string;
  updatedAt: string;
}
