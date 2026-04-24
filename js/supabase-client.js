// Initialize Supabase Client with Safety check
const { createClient } = window.supabase || {};
const sb = createClient ? createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY) : null;
if (!sb) console.error("CRITICAL: Supabase client could not be initialized. Check CDN.");

/**
 * Utility function to handle Supabase responses
 */
async function handleResponse(promise) {
    if (!sb) {
        const err = new Error("La connexion à la base de données n'est pas établie.");
        console.error(err.message);
        return null;
    }
    try {
        const { data, error } = await promise;
        if (error) throw error;
        return data;
    } catch (err) {
        console.error("Supabase Error:", err.message);
        // Avoid showing notification for background checks if not needed, 
        // but here it's better to inform the user.
        UI.notify("Erreur base de données : " + err.message, "error");
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

    async createAssociation(assocData) {
        return await handleResponse(
            sb.from('associations').insert([assocData]).select().single()
        );
    },

    async createProfile(profileData) {
        return await handleResponse(
            sb.from('profiles').insert([profileData])
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
