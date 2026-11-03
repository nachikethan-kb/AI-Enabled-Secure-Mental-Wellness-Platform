// By default, use the same-origin Vite proxy. This works when both laptops
// open the frontend served by the host laptop (http://HOST_LAN_IP:5173).
// For a separately deployed frontend, set VITE_API_BASE_URL to the backend URL.
const getApiBaseUrl = () => {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (!configured) return "/api/v1";
  // A leftover "http://localhost:8000/..." in frontend/.env would make the SECOND laptop call
  // ITSELF (localhost = that laptop). When the page is opened through a LAN address, ignore a
  // localhost setting and use the same-origin Vite proxy, which forwards to the host's backend.
  const configuredIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(configured);
  const pageIsLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (configuredIsLocal && !pageIsLocal) return "/api/v1";
  return configured;
};

const API_BASE_URL = getApiBaseUrl();

// FastAPI validation errors arrive as a list of {loc, msg}; turn them into readable text.
function formatErrorDetail(detail) {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        const field = Array.isArray(d.loc) ? d.loc.filter((x) => x !== "body" && x !== "form").join(".") : "";
        return field ? `${field}: ${d.msg}` : d.msg;
      })
      .join("; ");
  }
  return typeof detail.message === "string" ? detail.message : JSON.stringify(detail);
}

async function request(path, options = {}) {
  const token = localStorage.getItem("token");
  const { headers, ...rest } = options;
  const isFormData = rest.body instanceof FormData;
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
      },
      ...rest,
    });
  } catch {
    throw new Error("Cannot reach the Healthly backend. Make sure it is running and that you opened the app using the host laptop's address (http://HOST_IP:5173).");
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(formatErrorDetail(data.detail) || `Request failed (HTTP ${response.status})`);
  }

  return response.json();
}

export const api = {
  register: (payload) => request("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  registerConsultant: (formData) => request("/auth/register-consultant", { method: "POST", body: formData }),
  uploadCredential: (formData) => request("/auth/credential", { method: "POST", body: formData }),
  login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request("/auth/me"),
  submitPHQ9: (answers) => request("/assessment/phq9", { method: "POST", body: JSON.stringify({ answers }) }),
  getPHQ9History: () => request("/assessment/phq9/history", { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } }),
  sendMessage: (message) => request("/chat/message", { method: "POST", body: JSON.stringify({ message }) }),
  getChatHistory: () => request("/chat/history"),
  getCompanionStatus: () => request("/chat/companion-status", { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } }),
  listForumPosts: () => request("/forum/posts"),
  createForumPost: (payload) => request("/forum/posts", { method: "POST", body: JSON.stringify(payload) }),
  
  // Comprehensive multimodal assessment
  submitHealthReport: (filename, raw_text) => 
    request("/multimodal/report", { 
      method: "POST", 
      body: JSON.stringify({ filename, raw_text }) 
    }),
  submitSensorData: (sensorData) => 
    request("/multimodal/sensor", { 
      method: "POST", 
      body: JSON.stringify(sensorData) 
    }),
  submitSessionAnalytics: (sessionData) => 
    request("/multimodal/session", { 
      method: "POST", 
      body: JSON.stringify(sessionData) 
    }),
  analyzeFrame: (image_base64) => 
    request("/multimodal/analyze-frame", { 
      method: "POST", 
      body: JSON.stringify({ image_base64 }) 
    }),
  getMultimodalDashboard: () => 
    request("/multimodal/dashboard", { 
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } 
    }),
  submitComprehensiveAssessment: (assessmentData) => 
    request("/multimodal/comprehensive-assessment", { 
      method: "POST", 
      body: JSON.stringify(assessmentData) 
    }),

  // Wearable Integration (Android SensorApp, paired over WiFi)
  startWifiPairing: () => request("/bluetooth/connect", { method: "POST" }),
  disconnectBluetoothDevice: () => request("/bluetooth/disconnect", { method: "POST" }),
  getBluetoothStatus: () => request("/bluetooth/status", { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } }),
  getBluetoothStreamUrl: () => {
    const isAbsoluteUrl = /^https?:\/\//.test(API_BASE_URL);
    if (isAbsoluteUrl) {
      const isSecure = API_BASE_URL.startsWith("https:");
      const base = API_BASE_URL.replace(/^http/, isSecure ? "wss" : "ws");
      return `${base}/bluetooth/stream`;
    }

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProtocol}//${window.location.host}${API_BASE_URL}/bluetooth/stream`;
  },

  // Doctor video-call feature
  listDoctors: () => request("/video-call/doctors"),
  requestCall: (doctorId) => request("/video-call/request", { method: "POST", body: JSON.stringify({ doctor_id: doctorId }) }),
  getPendingCalls: () => request("/video-call/pending", { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } }),
  getMyCalls: () => request("/video-call/mine", { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } }),
  getCallRoom: (roomId) => request(`/video-call/room/${roomId}`),
  acceptCall: (callId) => request(`/video-call/${callId}/accept`, { method: "POST" }),
  rejectCall: (callId) => request(`/video-call/${callId}/reject`, { method: "POST" }),
  endCall: (callId) => request(`/video-call/${callId}/end`, { method: "POST" }),
  getCallSocketUrl: (roomId) => {
    const token = localStorage.getItem("token") || "";
    const isAbsoluteUrl = /^https?:\/\//.test(API_BASE_URL);
    if (isAbsoluteUrl) {
      const isSecure = API_BASE_URL.startsWith("https:");
      const base = API_BASE_URL.replace(/^http/, isSecure ? "wss" : "ws").replace(/\/api\/v1$/, "");
      return `${base}/ws/video-call/${roomId}?token=${encodeURIComponent(token)}`;
    }
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // Relative API mode uses the Vite /ws proxy; absolute mode above connects
    // directly to the configured backend host.
    return `${wsProtocol}//${window.location.host}/ws/video-call/${roomId}?token=${encodeURIComponent(token)}`;
  },

  // Admin endpoints
  getAdminUsers: () => request("/admin/users"),
  updateUserRole: (userId, role) => request(`/admin/users/${userId}/role`, { method: "PUT", body: JSON.stringify({ role }) }),
  getAdminStats: () => request("/admin/stats"),
  getConsultants: () => request("/admin/consultants"),
  getCredentialUrl: (doctorId) => `${API_BASE_URL}/admin/consultants/${doctorId}/credential`,
  // A plain <a href> cannot send the login token (backend rejects it). Fetch the PDF with the
  // Authorization header and open it from a blob URL instead.
  openCredential: async (doctorId) => {
    const token = localStorage.getItem("token");
    const popup = window.open("", "_blank");
    try {
      const response = await fetch(`${API_BASE_URL}/admin/consultants/${doctorId}/credential`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(formatErrorDetail(data.detail) || `Could not open credential (HTTP ${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (popup) popup.location.href = url;
      else window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    } catch (e) {
      if (popup) popup.close();
      throw e;
    }
  },
  verifyConsultant: (doctorId, status, note) => request(`/admin/consultants/${doctorId}/verify`, { method: "POST", body: JSON.stringify({ status, note }) }),
  getAssignments: () => request("/admin/assignments"),
  createAssignment: (patientId, doctorId) => request("/admin/assignments", { method: "POST", body: JSON.stringify({ patient_id: patientId, doctor_id: doctorId }) }),
  deleteAssignment: (assignmentId) => request(`/admin/assignments/${assignmentId}`, { method: "DELETE" }),

  // Consultant / Admin shared endpoints
  getPatients: () => request("/admin/patients"),
  getPatientSensorData: (patientId) => request(`/admin/patients/${patientId}/sensor-data`),

  // WiFi Telemetry Ingestion Endpoints
  getWifiUsers: () => request("/../../api/users"),
  getWifiHistory: (userId, limit = 20) => request(`/../../api/users/${userId}/history?limit=${limit}`),
  getWifiRecommendations: (userId) => request(`/../../api/users/${userId}/recommendations`),
  getWifiTrends: (userId) => request(`/../../api/users/${userId}/trends`),
  getWifiLatest: (userId) => request(`/../../api/users/${userId}/latest`),
  getWifiRisk: (userId) => request(`/../../api/users/${userId}/risk`),
  submitWifiPHQ9: (userId, answers) => request("/../../api/phq9-assessment", { method: "POST", body: JSON.stringify({ user_id: userId, answers }) }),
  getWifiStreamUrl: (userId) => {
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? `${window.location.hostname}:8000`
      : window.location.host;
    return `${wsProtocol}//${host}/ws/dashboard/${userId}`;
  },
};

