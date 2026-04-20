// Initialize Supabase Client
const { createClient } = supabase;
const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

/**
 * Utility function to handle Supabase responses
 */
async function handleResponse(promise) {
    try {
        const { data, error } = await promise;
        if (error) throw error;
        return data;
    } catch (err) {
        console.error("Supabase Error:", err.message);
        UI.notify(err.message, "error");
        throw err;
    }
}

/**
 * Database Functions
 */
const DB = {
    // Auth related
    async getProfile(userId) {
        const data = await handleResponse(
            sb.from('profiles').select('*').eq('id', userId).single()
        );
        return data;
    },

    // Associations
    async getAssociation(assocId) {
        return await handleResponse(
            sb.from('associations').select('*').eq('id', assocId).single()
        );
    },

    // Applications
    async getApplicationsByAssoc(assocId) {
        return await handleResponse(
            sb.from('grant_applications')
              .select('*')
              .eq('association_id', assocId)
              .order('year', { ascending: false })
        );
    },

    // Form Configuration (Dynamic)
    async getFormAxes() {
        return await handleResponse(
            sb.from('form_axes').select('*').order('code')
        );
    },

    async getAxeMetrics(axeCode) {
        return await handleResponse(
            sb.from('form_metrics_config').select('*').eq('axe_code', axeCode).order('created_at')
        );
    },

    async getFullApplication(appId) {
        const application = await handleResponse(
            sb.from('grant_applications').select('*').eq('id', appId).single()
        );
        const financials = await handleResponse(
            sb.from('financial_records').select('*').eq('application_id', appId)
        );
        const metrics = await handleResponse(
            sb.from('application_metrics').select('*').eq('application_id', appId)
        );
        
        return { ...application, financials, metrics };
    }
};
