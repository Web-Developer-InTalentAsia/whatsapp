/**
 * AbunthraHR API Client
 * Centralised Axios instance with JWT token injection and refresh logic.
 */
import axios from "axios";
import Cookies from "js-cookie";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// ---------------------------------------------------------------------------
// Request interceptor — inject access token + active company context
// ---------------------------------------------------------------------------
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Super admin company switching — send selected company to backend
    const companyId = Cookies.get("abunthrahr_company_id");
    if (companyId) {
      config.headers["X-Company-ID"] = companyId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---------------------------------------------------------------------------
// Response interceptor — silent refresh on 401
// ---------------------------------------------------------------------------
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = Cookies.get("refresh_token");
      if (!refreshToken) {
        _logout();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        Cookies.set("access_token", data.access_token, { secure: true, sameSite: "strict" });
        Cookies.set("refresh_token", data.refresh_token, { secure: true, sameSite: "strict" });
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        processQueue(null, data.access_token);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        _logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

function _logout() {
  Cookies.remove("access_token");
  Cookies.remove("refresh_token");
  Cookies.remove("user");
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------
export const authApi = {
  login: (email, password) => api.post("/auth/login", { email, password }),
  verifyTotp: (temp_token, totp_code) => api.post("/auth/verify-totp", { temp_token, totp_code }),
  verifyOtp: (temp_token, otp_code) => api.post("/auth/verify-otp", { temp_token, otp_code }),
  refresh: (refresh_token) => api.post("/auth/refresh", { refresh_token }),
  logout: () => api.post("/auth/logout"),
  me: () => api.get("/auth/me"),
  requestSensitiveOtp: (purpose) => api.post("/auth/sensitive-otp", { purpose }),
  setupTotpInitiate: () => api.post("/auth/setup-totp/initiate"),
  setupTotpConfirm: (otp_code) => api.post("/auth/setup-totp/confirm", { otp_code }),
};

// ---------------------------------------------------------------------------
// Employee API
// ---------------------------------------------------------------------------
export const employeeApi = {
  list: (params) => api.get("/employees", { params }),
  get: (id) => api.get(`/employees/${id}`),
  create: (data) => api.post("/employees", data),
  update: (id, data) => api.patch(`/employees/${id}`, data),
  terminate: (id, last_working_date, reason) =>
    api.post(`/employees/${id}/terminate`, null, { params: { last_working_date, reason } }),
  listDepartments: () => api.get("/employees/departments/list"),
  createDepartment: (code, name, parent_id) =>
    api.post("/employees/departments", null, { params: { code, name, parent_id } }),
};

// ---------------------------------------------------------------------------
// Attendance API
// ---------------------------------------------------------------------------
export const attendanceApi = {
  list: (params) => api.get("/attendance", { params }),
  createManual: (data) => api.post("/attendance", data),
  update: (id, data) => api.patch(`/attendance/${id}`, data),
  approve: (record_ids) => api.post("/attendance/approve", { record_ids }),
  listDevices: () => api.get("/attendance/devices"),
  addDevice: (data) => api.post("/attendance/devices", data),
  testDevice: (id) => api.post(`/attendance/devices/${id}/test`),
  sync: (data) => api.post("/attendance/sync", data),
};

// ---------------------------------------------------------------------------
// Leave API
// ---------------------------------------------------------------------------
export const leaveApi = {
  listTypes: () => api.get("/leave/types"),
  createType: (data) => api.post("/leave/types", data),
  getBalances: (params) => api.get("/leave/balances", { params }),
  listRequests: (params) => api.get("/leave/requests", { params }),
  submitRequest: (data) => api.post("/leave/requests", data),
  supervisorAction: (id, action, note) =>
    api.post(`/leave/requests/${id}/supervisor-action`, { action, note }),
  hrAction: (id, action, note) =>
    api.post(`/leave/requests/${id}/hr-action`, { action, note }),
  clientAction: (id, action, note) =>
    api.post(`/leave/requests/${id}/client-action`, { action, note }),
  finalAction: (id, action, note) =>
    api.post(`/leave/requests/${id}/final-action`, { action, note }),
  cancel: (id) => api.post(`/leave/requests/${id}/cancel`),
  adminAction: (id, action, note) =>
    api.post(`/leave/requests/${id}/admin-action`, { action, note }),
  // Holidays
  listHolidays: (year) => api.get("/leave/holidays", { params: year ? { year } : {} }),
  createHoliday: (data) => api.post("/leave/holidays", data),
  deleteHoliday: (id) => api.delete(`/leave/holidays/${id}`),
  // Allocations
  listAllocations: (params) => api.get("/leave/allocations", { params }),
  allocate: (data) => api.post("/leave/allocate", data),
};

// ---------------------------------------------------------------------------
// Payroll API
// ---------------------------------------------------------------------------
export const payrollApi = {
  listPeriods: (params) => api.get("/payroll/periods", { params }),
  createPeriod: (data) => api.post("/payroll/periods", data),
  calculatePeriod: (id) => api.post(`/payroll/periods/${id}/calculate`),
  transitionStatus: (id, new_status, otp_code) =>
    api.post(`/payroll/periods/${id}/transition`, { new_status, otp_code }),
  listPayslips: (period_id, params) =>
    api.get(`/payroll/periods/${period_id}/payslips`, { params }),
  getPayslip: (id) => api.get(`/payroll/payslips/${id}`),
  getPeriodSummary: (id) => api.get(`/payroll/periods/${id}/summary`),
  listRules: () => api.get("/payroll/rules"),
  createRule: (data) => api.post("/payroll/rules", data),
  updateRule: (id, data) => api.patch(`/payroll/rules/${id}`, data),
  deleteRule: (id) => api.delete(`/payroll/rules/${id}`),
};

// ---------------------------------------------------------------------------
// Compliance API
// ---------------------------------------------------------------------------
export const complianceApi = {
  listTaxTables: (params) => api.get("/compliance/tax-tables", { params }),
  bulkLoadTaxTables: (entries) => api.post("/compliance/tax-tables/bulk", { entries }),
  getEpfSchedule: (period_id) => api.get(`/compliance/epf-schedule/${period_id}`),
  getEtfSchedule: (period_id) => api.get(`/compliance/etf-schedule/${period_id}`),
  getApitReturn: (period_id) => api.get(`/compliance/apit-return/${period_id}`),
  getAuditLog: (params) => api.get("/compliance/audit-log", { params }),
};

// ---------------------------------------------------------------------------
// Reports API
// ---------------------------------------------------------------------------
export const reportsApi = {
  payrollCostTrend: (year) => api.get("/reports/payroll-cost-trend", { params: { year } }),
  departmentCost: (period_id) => api.get(`/reports/department-cost/${period_id}`),
  headcount: (as_of_date) => api.get("/reports/headcount", { params: { as_of_date } }),
  downloadBankFile: (period_id) =>
    api.get(`/reports/bank-files/${period_id}/download`, { responseType: "blob" }),
  downloadPayrollCsv: (period_id) =>
    api.get(`/reports/payroll-detail/${period_id}/csv`, { responseType: "blob" }),
  dashboardKpis: () => api.get("/reports/dashboard-kpis"),
};

// ---------------------------------------------------------------------------
// Companies API (super admin multi-company management)
// ---------------------------------------------------------------------------
export const companiesApi = {
  list: () => api.get("/companies"),
  create: (data) => api.post("/companies", data),
};

// Cookie helpers for company switching
export const activeCompanyId = () => Cookies.get("abunthrahr_company_id") || null;
export const setActiveCompany = (id) => {
  if (id) Cookies.set("abunthrahr_company_id", id, { sameSite: "lax" });
  else Cookies.remove("abunthrahr_company_id");
};

export default api;
