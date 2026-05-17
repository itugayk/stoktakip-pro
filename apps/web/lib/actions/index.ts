// Server Actions barrel export
export { signIn, signUp, signOut, getCurrentUser } from "./auth";

export {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  lookupBarcode,
  bulkUpdateProducts,
  bulkDeleteProducts,
  bulkPriceUpdate,
} from "./products";

export {
  getStockMovements,
  createStockMovement,
  getExpiringLots,
  getDashboardStats,
} from "./inventory";

export {
  getWarehouses,
  createWarehouse,
  deleteWarehouse,
  getSuppliers,
  createSupplier,
  deleteSupplier,
  getCustomers,
  createCustomer,
  deleteCustomer,
} from "./operations";

export { searchEverything } from "./search";
export type { SearchResults } from "./search";

export { completeOnboarding, getOnboardingStatus } from "./onboarding";

export { toggleFavorite, getFavorites } from "./favorites";
export type { FavoriteEntity } from "./favorites";

export {
  createCount,
  listCounts,
  recordCountScan,
  closeCount,
  getCountDetail,
} from "./counts";
export type { CountStatus, StockCount, StockCountItem } from "./counts";

export {
  listLocations,
  createLocation,
  deleteLocation,
  getLocationInventory,
} from "./locations";
export type { WarehouseLocation, LocationInventoryRow } from "./locations";

export {
  getReorderSuggestions,
  createDraftPOFromSuggestions,
  getInventoryTurnover,
  runABCAnalysis,
  getDeadStock,
} from "./analytics";
export type {
  ReorderSuggestion,
  TurnoverRow,
  ABCResult,
  ABCRow,
  ABCClass,
  DeadStockRow,
} from "./analytics";

export { getProductForecast } from "./forecast";
export type { ProductForecast } from "./forecast";

export {
  listExpiryRules,
  upsertExpiryRule,
  deleteExpiryRule,
  runExpiryRulesNow,
} from "./expiry-rules";
export type { ExpiryRule, Channel } from "./expiry-rules";

export {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationPrefs,
  updateNotificationPrefs,
} from "./notifications";
export type { Notification, NotificationType, NotificationPrefs } from "./notifications";

export { getAuditTrail } from "./audit";
export type { AuditLogEntry } from "./audit";

export {
  submitForApproval,
  approveOrder,
  rejectOrder,
  cancelOrder,
  receivePurchaseOrder,
  recordPick,
  shipSalesOrder,
  getOperationsSummary,
} from "./orders";
export type { POStatus, SOStatus, OperationsSummary } from "./orders";

export {
  createReturn,
  listReturns,
  approveReturn,
  receiveReturn,
} from "./returns";
export type { Return, ReturnType, ReturnStatus, ReturnItemCondition } from "./returns";

export {
  listPriceLists,
  upsertPriceList,
  deletePriceList,
  upsertPriceListItem,
  getPriceListItems,
  resolvePrice,
} from "./price-lists";
export type { PriceList, PriceListItem, PriceListScope } from "./price-lists";

export {
  listOrderTemplates,
  upsertOrderTemplate,
  deleteOrderTemplate,
} from "./order-templates";
export type { OrderTemplate, OrderTemplateType } from "./order-templates";

export { bulkImportProducts, getPartnerStatement } from "./import";
export type { StatementRow } from "./import";

export {
  getPeriodComparison,
  getProfitReport,
  getRevenueTrend,
} from "./reports";
export type {
  PeriodComparison,
  ProfitReport,
  ProfitRow,
  TrendPoint,
  CostMethod,
} from "./reports";

export {
  listScheduledReports,
  upsertScheduledReport,
  deleteScheduledReport,
} from "./scheduled-reports";
export type {
  ScheduledReport,
  ReportType as ScheduledReportType,
  Frequency as ScheduledFrequency,
} from "./scheduled-reports";

export { listComments, createComment, deleteComment } from "./comments";
export type { Comment, CommentEntityType } from "./comments";

export {
  listTasks,
  upsertTask,
  deleteTask,
  updateTaskStatus,
} from "./tasks";
export type { Task, TaskStatus, TaskPriority } from "./tasks";

export {
  listInvitations,
  createInvitation,
  revokeInvitation,
  acceptInvitation,
} from "./invitations";
export type { Invitation } from "./invitations";

export {
  getActivityFeed,
  listTeamMembers,
  updateTeamMember,
  getPlanLimits,
} from "./team";
export type { ActivityEntry, TeamMember, PlanLimits } from "./team";

export { listApiKeys, createApiKey, revokeApiKey } from "./api-keys";
export type { ApiKey } from "./api-keys";

export {
  listWebhooks,
  upsertWebhook,
  deleteWebhook,
  listWebhookDeliveries,
} from "./webhook-config";
export type { Webhook, WebhookDelivery } from "./webhook-config";
export { WEBHOOK_EVENTS } from "@/lib/webhooks/events";
export type { WebhookEvent } from "@/lib/webhooks/events";

export {
  listConnections,
  upsertConnection,
  deleteConnection,
  testConnection,
} from "./integrations";
export type { Connection } from "./integrations";

export { exportCompanyData, requestCompanyDeletion } from "./data-export";
export type { DataExport } from "./data-export";
