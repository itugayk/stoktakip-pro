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
  updateWarehouse,
  deleteWarehouse,
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "./operations";

export {
  createSale,
  getSales,
  getSale,
  cancelSale,
} from "./sales";
export type { SaleRow, SaleDetail } from "./sales";

export {
  recordPayment,
  listPayments,
  deletePayment,
} from "./payments";
export type { PaymentRow } from "./payments";

export {
  createDeliveryNote,
  listDeliveryNotes,
  getDeliveryNote,
  updateDeliveryNoteStatus,
  deleteDeliveryNote,
} from "./delivery-notes";
export type { DeliveryNoteRow, DeliveryNoteDetail } from "./delivery-notes";

export {
  listExpenses,
  createExpense,
  deleteExpense,
} from "./expenses";
export type { ExpenseRow } from "./expenses";

export { searchEverything } from "./search";
export type { SearchResults } from "./search";

export { completeOnboarding, getOnboardingStatus } from "./onboarding";

export {
  listRecipes,
  getRecipe,
  upsertRecipe,
  deleteRecipe,
  produceRecipe,
} from "./recipes";
export type { RecipeRow, RecipeDetail } from "./recipes";

export {
  getBusinessProfile,
  updateBusinessProfile,
} from "./business-profile";
export type { BusinessProfile } from "./business-profile";

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
  getSalesOrders,
  createSalesOrder,
  approveSalesOrder,
  cancelSalesOrder,
  getPurchaseOrders,
  createPurchaseOrder,
  getOperationsSummary,
} from "./orders";
export type {
  POStatus,
  SOStatus,
  OperationsSummary,
  SalesOrderRow,
  PurchaseOrderRow,
} from "./orders";

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
  getBusinessPnL,
} from "./reports";
export type {
  PeriodComparison,
  ProfitReport,
  ProfitRow,
  TrendPoint,
  CostMethod,
  BusinessPnL,
  MethodAmount,
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

export {
  exportCompanyData,
  requestCompanyDeletion,
  hardDeleteCompany,
} from "./data-export";
export type { DataExport } from "./data-export";
