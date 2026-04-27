// Initialize Supabase Client with Safety check and proper auth config
const { createClient } = window.supabase || {};
const sb = createClient ? createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
    }
}) : null;
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
        return await handleResponse(
            sb.from('profiles').select('*').eq('id', userId).single()
        );
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

    async updateAssociation(assocId, data) {
        return await handleResponse(
            sb.from('associations').update(data).eq('id', assocId).select().single()
        );
    },

    async createProfile(profileData) {
        return await handleResponse(
            sb.from('profiles').upsert([profileData])
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

    async getAllApplications() {
        return await handleResponse(
            sb.from('grant_applications')
              .select('*, associations(name, siret, contact_email)')
              .order('created_at', { ascending: false })
        );
    },

    async getAllAssociations() {
        return await handleResponse(
            sb.from('associations').select('*')
        );
    },

    // Form Configuration (Dynamic)
    async getFormAxes() {
        return await handleResponse(
            sb.from('form_axes').select('*').order('code')
        );
    },

    async getAxeMetrics(axeCode) {
        // Get metrics linked to this axe via the pivot table
        const links = await handleResponse(
            sb.from('metric_axe_links')
              .select('metric_id, form_metrics_config(*)')
              .eq('axe_code', axeCode)
        );
        if (links && links.length > 0) {
            return links.map(l => l.form_metrics_config).filter(Boolean);
        }
        // Fallback: old direct link system
        return await handleResponse(
            sb.from('form_metrics_config').select('*').eq('axe_code', axeCode).order('created_at')
        );
    },

    async getAllMetrics() {
        return await handleResponse(
            sb.from('form_metrics_config').select('*').order('label')
        );
    },

    async getAllMetricAxeLinks() {
        return await handleResponse(
            sb.from('metric_axe_links').select('*')
        );
    },

    async toggleMetricAxe(metricId, axeCode, enabled) {
        if (enabled) {
            return await handleResponse(
                sb.from('metric_axe_links').upsert([{ metric_id: metricId, axe_code: axeCode }], { onConflict: 'metric_id, axe_code' })
            );
        } else {
            return await handleResponse(
                sb.from('metric_axe_links').delete().eq('metric_id', metricId).eq('axe_code', axeCode)
            );
        }
    },

    async addMetric(label, inputType, metricKey) {
        return await handleResponse(
            sb.from('form_metrics_config').insert([{ label, input_type: inputType, metric_key: metricKey }]).select().single()
        );
    },

    async deleteMetric(metricId) {
        return await handleResponse(
            sb.from('form_metrics_config').delete().eq('id', metricId)
        );
    },

    async getFullApplication(appId) {
        const application = await handleResponse(
            sb.from('grant_applications').select('*, associations(*)').eq('id', appId).single()
        );
        const financials = await handleResponse(
            sb.from('financial_records').select('*').eq('application_id', appId)
        );
        const metrics = await handleResponse(
            sb.from('application_metrics').select('*').eq('application_id', appId)
        );
        
        return { ...application, financials: financials || [], metrics: metrics || [] };
    },

    async deleteApplication(appId) {
        return await handleResponse(
            sb.from('grant_applications').delete().eq('id', appId)
        );
    },

    // Previous year application (for N-2/N-3 prefill)
    async getPreviousYearApplication(assocId, currentYear, axeCode) {
        const apps = await handleResponse(
            sb.from('grant_applications')
              .select('*')
              .eq('association_id', assocId)
              .eq('year', currentYear - 1)
              .eq('selected_axe', axeCode)
              .in('status', ['submitted', 'validated'])
              .limit(1)
        );
        if (apps && apps.length > 0) {
            const financials = await handleResponse(
                sb.from('financial_records').select('*').eq('application_id', apps[0].id)
            );
            return { ...apps[0], financials: financials || [] };
        }
        return null;
    },

    // Messages
    async getMessages(applicationId) {
        return await handleResponse(
            sb.from('messages')
              .select('*')
              .eq('application_id', applicationId)
              .order('created_at', { ascending: true })
        );
    },

    async sendMessage(applicationId, senderRole, content) {
        return await handleResponse(
            sb.from('messages')
              .insert([{ application_id: applicationId, sender_role: senderRole, content }])
              .select().single()
        );
    },

    // Update application
    async updateApplication(appId, data) {
        return await handleResponse(
            sb.from('grant_applications').update(data).eq('id', appId).select().single()
        );
    }
};
