/**
 * Administrator Dashboard Logic
 */
const ADMIN = {
    initialized: false,
    async init() {
        if (this.initialized || !STATE.user) return;
        if (STATE.user.email.toLowerCase() !== CONFIG.AO_EMAIL.toLowerCase()) return;
        
        this.initialized = true;
        // Setup listeners for admin actions (Delegation)
        document.body.addEventListener('click', async (e) => {
            if (e.target.id === 'send-invite') {
                await ADMIN.inviteAssociation();
            }
        });
    },

    async inviteAssociation() {
        const email = document.getElementById('invite-email').value;
        if (!email) return UI.notify("Veuillez saisir une adresse mail.", "error");

        UI.toggleLoader(true);
        try {
            const { error } = await sb.from('prevalidated_emails').insert([
                { email: email, created_at: new Date() }
            ]);
            
            if (error) throw error;
            UI.notify(`Invitation envoyée à ${email}. Valide 3 jours.`, "success");
            UI.switchView('admin-dashboard'); 
        } catch (err) {
            UI.notify(err.message, "error");
        } finally {
            UI.toggleLoader(false);
        }
    },

    async renderAdminDashboard() {
        const preValed = await handleResponse(sb.from('prevalidated_emails').select('*').order('created_at', { ascending: false }));
        const associations = await handleResponse(sb.from('associations').select('*'));
        const axes = await handleResponse(sb.from('form_axes').select('*').order('code'));
        
        return `
            <div class="admin-grid">
                <section class="card">
                    <h3>Inviter une association</h3>
                    <div class="input-group">
                        <label>Email de l'association</label>
                        <input type="email" id="invite-email" placeholder="contact@asso.fr">
                    </div>
                    <button class="btn btn-primary" id="send-invite">Envoyer l'invitation</button>
                    
                    <h4 style="margin-top:20px">Invitations en attente</h4>
                    <ul class="activity-list">
                        ${preValed.map(inv => `
                            <li>
                                <strong>${inv.email}</strong> - Créée le ${new Date(inv.created_at).toLocaleDateString()}
                                ${inv.used_at ? '<span class="badge success">Utilisée</span>' : '<span class="badge warning">En attente</span>'}
                            </li>
                        `).join('') || '<li>Aucune invitation</li>'}
                    </ul>
                </section>

                <section class="card">
                    <h3>Dossiers à instruire</h3>
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Association</th>
                                    <th>Année</th>
                                    <th>Statut</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${associations.map(assoc => `
                                    <tr>
                                        <td>${assoc.name}</td>
                                        <td>2026</td>
                                        <td><span class="badge">En cours</span></td>
                                        <td><button class="btn btn-icon" onclick="UI.switchView('admin-view-dossier', '${assoc.id}')"><i class="fas fa-eye"></i></button></td>
                                    </tr>
                                `).join('') || '<tr><td colspan="4">Aucun dossier soumis</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section class="card full-width config-card" id="config-section">
                    <div class="card-header-icon">
                        <i class="fas fa-cogs"></i>
                        <h3>Configuration des Axes & Questions métiers</h3>
                    </div>
                    <p class="help-text">Gérez ici les axes de financement (Etape 4) et les questions spécifiques demandées aux associations (Etape 5).</p>
                    
                    <div class="config-container">
                        <div class="config-sidebar">
                            <h4>1. Choisir l'Axe</h4>
                            <div class="config-list">
                                ${axes.map(axe => `
                                    <div class="config-item ${STATE.selectedAxe === axe.code ? 'active' : ''}" onclick="ADMIN.selectAxe('${axe.code}')">
                                        <span class="axe-code">${axe.code}</span>
                                        <span class="axe-label">${axe.principal}</span>
                                        <button class="btn-delete" onclick="event.stopPropagation(); ADMIN.deleteAxe('${axe.code}')">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                `).join('') || '<p class="empty">Aucun axe défini</p>'}
                            </div>
                            <div class="mini-form">
                                <input type="text" id="new-axe-code" placeholder="Code (ex: 5a)">
                                <input type="text" id="new-axe-label" placeholder="Intitulé de l'axe">
                                <button class="btn btn-primary btn-sm" onclick="ADMIN.addAxe()">Ajouter l'axe</button>
                            </div>
                        </div>

                        <div class="config-main" id="metrics-management">
                            ${this.tplMetricsManagement()}
                        </div>
                    </div>
                </section>
            </div>
        `;
    },

    async addAxe() {
        const code = document.getElementById('new-axe-code').value;
        const label = document.getElementById('new-axe-label').value;
        if (!code || !label) return UI.notify("Veuillez remplir le code et le nom.", "error");

        UI.toggleLoader(true);
        try {
            await sb.from('form_axes').insert([{ code, principal: label }]);
            UI.notify("Axe ajouté avec succès.", "success");
            UI.switchView('admin-dashboard');
        } catch (err) {
            UI.notify(err.message, "error");
        } finally {
            UI.toggleLoader(false);
        }
    },

    async deleteAxe(code) {
        if (!confirm("Voulez-vous vraiment supprimer cet axe et TOUTES ses questions associées ?")) return;
        UI.toggleLoader(true);
        try {
            await sb.from('form_axes').delete().eq('code', code);
            if (STATE.selectedAxe === code) STATE.selectedAxe = null;
            UI.notify("Axe supprimé.", "success");
            UI.switchView('admin-dashboard');
        } catch (err) {
            UI.notify(err.message, "error");
        } finally {
            UI.toggleLoader(false);
        }
    },

    tplMetricsManagement() {
        if (!STATE.selectedAxe) {
            return `
                <div class="empty-state">
                    <i class="fas fa-arrow-left"></i>
                    <p>Sélectionnez un axe à gauche pour configurer les questions spécifiques.</p>
                </div>
            `;
        }

        const metrics = STATE.currentAxeMetrics || [];

        return `
            <h4>2. Questions demandées pour l'axe ${STATE.selectedAxe}</h4>
            <div class="metrics-grid">
                ${metrics.map(m => `
                    <div class="metric-config-item card">
                        <div class="metric-main">
                            <strong>${m.label}</strong>
                            <span class="type-tag">${m.input_type}</span>
                        </div>
                        <button class="btn-icon text-danger" onclick="ADMIN.deleteMetric('${m.id}')">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                `).join('') || '<div class="info-box">Aucune question spécifique pour cet axe. Toutes les associations verront le même formulaire de base.</div>'}
            </div>
            
            <div class="add-metric-box card">
                <h5>Ajouter une question pour cet axe</h5>
                <div class="mini-form">
                    <input type="text" id="new-metric-label" placeholder="Ex: Nombre d'enfants accueillis">
                    <select id="new-metric-type">
                        <option value="number">Nombre (chiffres)</option>
                        <option value="text">Texte libre</option>
                        <option value="date">Date</option>
                        <option value="time">Horaires / Durée</option>
                    </select>
                    <button class="btn btn-primary" onclick="ADMIN.addMetric()">Ajouter la question</button>
                </div>
            </div>
        `;
    },

    async selectAxe(code) {
        STATE.selectedAxe = code;
        UI.toggleLoader(true);
        try {
            STATE.currentAxeMetrics = await DB.getAxeMetrics(code);
            UI.switchView('admin-dashboard');
        } catch (err) {
            UI.notify(err.message, "error");
        } finally {
            UI.toggleLoader(false);
        }
    },

    async addMetric() {
        const label = document.getElementById('new-metric-label').value;
        const type = document.getElementById('new-metric-type').value;
        if (!label) return UI.notify("Veuillez saisir un intitulé.", "error");

        UI.toggleLoader(true);
        try {
            const metricKey = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
            await sb.from('form_metrics_config').insert([{ 
                axe_code: STATE.selectedAxe, 
                label, 
                input_type: type,
                metric_key: metricKey 
            }]);
            UI.notify("Question ajoutée.", "success");
            await this.selectAxe(STATE.selectedAxe); // Refresh metrics
        } catch (err) {
            UI.notify(err.message, "error");
        } finally {
            UI.toggleLoader(false);
        }
    },

    async deleteMetric(id) {
        if (!confirm("Supprimer cette question ?")) return;
        UI.toggleLoader(true);
        try {
            await sb.from('form_metrics_config').delete().eq('id', id);
            UI.notify("Question supprimée.", "success");
            await this.selectAxe(STATE.selectedAxe); 
        } catch (err) {
            UI.notify(err.message, "error");
        } finally {
            UI.toggleLoader(false);
        }
    },

    async renderDossierDetail(assocId) {
        UI.toggleLoader(true);
        try {
            const assoc = await DB.getAssociation(assocId);
            const apps = await DB.getApplicationsByAssoc(assocId);
            const app = apps.find(a => a.year === 2026) || apps[0];
            const full = await DB.getFullApplication(app.id);
            
            // Calculate Ratios
            const assets = { 
                disponibilites: full.application.actif_dispo || 0,
                creances: full.application.actif_creances || 0,
                dettes: full.application.passif_dettes || 0
            };
            const liabilities = { 
                total: (full.application.passif_fonds || 0) + (full.application.passif_dettes || 0),
                fonds_propres: full.application.passif_fonds || 0
            };
            const analysis = UTILS.calculateRatios(full.financials, assets, liabilities);

            return `
                <div class="admin-detail-view">
                    <div class="header-actions">
                        <button class="btn" onclick="UI.switchView('admin-dashboard')">← Retour</button>
                        <div class="status-selector">
                            <label>Statut :</label>
                            <select onchange="ADMIN.updateStatus('${app.id}', this.value)">
                                <option value="draft" ${app.status === 'draft' ? 'selected' : ''}>Brouillon</option>
                                <option value="submitted" ${app.status === 'submitted' ? 'selected' : ''}>Soumis</option>
                                <option value="validé" ${app.status === 'validé' ? 'selected' : ''}>Validé</option>
                                <option value="refusé" ${app.status === 'refusé' ? 'selected' : ''}>Refusé</option>
                                <option value="frozen" ${app.status === 'frozen' ? 'selected' : ''}>Figé (RGPD)</option>
                            </select>
                        </div>
                    </div>

                    <div class="grid-2">
                        <section class="card">
                            <h3>Identité & Demande</h3>
                            <p><strong>Association :</strong> ${assoc.name}</p>
                            <p><strong>SIRET :</strong> ${assoc.siret}</p>
                            <p><strong>Axe choisi :</strong> ${app.selected_axe}</p>
                            <p class="highlight"><strong>Montant demandé :</strong> ${app.total_requested} €</p>
                        </section>

                        <section class="card">
                            <h3>📊 Analyse de Risques (Fiche Instructeur)</h3>
                            <div class="risk-indicators">
                                <div class="risk-item">
                                    <label>Trésorerie (Dispo seule)</label>
                                    <span class="badge ${UTILS.getRiskLevel('treasuryDaysRaw', analysis.ratios.treasuryDaysRaw)}">
                                        ${analysis.ratios.treasuryDaysRaw} jours
                                    </span>
                                </div>
                                <div class="risk-item">
                                    <label>Trésorerie ajustée (Dispo + Créances - Dettes)</label>
                                    <span class="badge ${UTILS.getRiskLevel('treasuryDaysAdjusted', analysis.ratios.treasuryDaysAdjusted)}">
                                        ${analysis.ratios.treasuryDaysAdjusted} jours
                                    </span>
                                </div>
                                <div class="risk-item">
                                    <label>Autonomie Financière</label>
                                    <span class="badge ${UTILS.getRiskLevel('financialAutonomy', analysis.ratios.financialAutonomy)}">
                                        ${(analysis.ratios.financialAutonomy * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <div class="risk-item">
                                    <label>Dépendance CCMVR</label>
                                    <span class="badge ${UTILS.getRiskLevel('ccmvrDependence', analysis.ratios.ccmvrDependence)}">
                                        ${analysis.ratios.ccmvrDependence}%
                                    </span>
                                </div>
                            </div>
                        </section>
                    </div>

                    <section class="card wide">
                        <h3>Détails de l'activité (Métrique Étape 4)</h3>
                        <div class="grid-2">
                            ${Object.entries(full.metrics).map(([k, v]) => `<div><strong>${k} :</strong> ${v}</div>`).join('') || 'Aucune donnée'}
                        </div>
                    </section>
                </div>
            `;
        } catch (err) {
            return `<div class="error">Erreur lors du chargement : ${err.message}</div>`;
        } finally {
            UI.toggleLoader(false);
        }
    },

    async updateStatus(appId, newStatus) {
        UI.toggleLoader(true);
        try {
            await sb.from('grant_applications').update({ status: newStatus }).eq('id', appId);
            UI.notify(`Statut mis à jour : ${newStatus}`, "success");
        } catch (err) {
            UI.notify(err.message, "error");
        } finally {
            UI.toggleLoader(false);
        }
    }
};
