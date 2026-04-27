// Supabase Configuration
const CONFIG = {
    SUPABASE_URL: "https://fnudhgwtgqznstnmzdfp.supabase.co",
    SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZudWRoZ3d0Z3F6bnN0bm16ZGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODY4NjUsImV4cCI6MjA5MjI2Mjg2NX0.KfZ0U0sM62bEoCLZVgETorMuHrlODXVjIyXg_ro1nAY",
    AO_EMAIL: "Admin@ccmvr.fr",
    DATA_RETENTION_YEARS: 10,
    REGISTRATION_VALIDITY_DAYS: 3,
    GITHUB_REPO: "mjacquiot/Demande-de-subvention",
    CURRENT_YEAR: 2026
};

// Application State
const STATE = {
    user: null,
    profile: null,
    association: null,
    currentView: 'dashboard',
    lastApplication: null,
    viewData: null,       // Extra data passed to switchView (e.g. assocId for admin)
    selectedAxe: null,
    currentAxeMetrics: null
};

// Centralized state cleanup
function cleanState() {
    STATE.user = null;
    STATE.profile = null;
    STATE.association = null;
    STATE.currentView = 'dashboard';
    STATE.lastApplication = null;
    STATE.viewData = null;
    STATE.selectedAxe = null;
    STATE.currentAxeMetrics = null;

    // Reset FORM data if it exists
    if (typeof FORM !== 'undefined' && FORM.resetData) {
        FORM.resetData();
        FORM.currentStep = 1;
    }

    // Reset ADMIN state
    if (typeof ADMIN !== 'undefined') {
        ADMIN.initialized = false;
    }
}
