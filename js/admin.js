const ADMIN = {
    initialized: false,
    async init() {
        if (this.initialized || !STATE.user) return;
        if (STATE.user.email.toLowerCase() !== CONFIG.AO_EMAIL.toLowerCase()) return;
        this.initialized = true;
    },

    async renderAdminDashboard() {
        const associations = await DB.getAllAssociations();
        const applications = await DB.getAllApplications();
        const axes = await DB.getFormAxes();
        const submittedApps = applications.filter(a => a.status !== 'draft');
        const statusLabels = { draft:'Brouillon', submitted:'Soumise', validated:'Validée', refused:'Refusée', frozen:'Figée' };

        return `<div class="admin-grid">
            <section class="card"><h3>Statistiques</h3>
                <div class="stats-grid">
                    <div class="stat-item"><span class="stat-value">${associations.length}</span><span class="stat-label">Associations</span></div>
                    <div class="stat-item"><span class="stat-value">${submittedApps.length}</span><span class="stat-label">Dossiers soumis</span></div>
                    <div class="stat-item"><span class="stat-value">${applications.filter(a=>a.status==='validated').length}</span><span class="stat-label">Validés</span></div>
                </div>
            </section>

            <section class="card">
                <h3>Dossiers à instruire</h3>
                <div style="margin-bottom:15px"><button class="btn btn-primary" style="width:auto" onclick="UI.switchView('admin-instruction')"><i class="fas fa-table"></i> Tableau d'instruction complet</button></div>
                <div class="table-responsive"><table class="financial-table">
                    <thead><tr><th>Association</th><th>Année</th><th>Axe</th><th>Montant</th><th>Statut</th><th>Action</th></tr></thead>
                    <tbody>${submittedApps.map(app => `<tr>
                        <td>${app.associations?.name || '?'}</td><td>${app.year}</td><td>${app.selected_axe||'-'}</td>
                        <td>${(app.total_requested||0).toLocaleString('fr-FR')} €</td>
                        <td><span class="badge">${statusLabels[app.status]||app.status}</span></td>
                        <td><button class="btn btn-icon" onclick="UI.switchView('admin-view-dossier','${app.id}')"><i class="fas fa-eye"></i></button></td>
                    </tr>`).join('')||'<tr><td colspan="6">Aucun dossier soumis</td></tr>'}</tbody>
                </table></div>
            </section>

            <section class="card full-width config-card" id="config-section">
                <div class="card-header-icon"><i class="fas fa-cogs"></i><h3>Configuration des Axes & Questions</h3></div>
                <p class="help-text">Gérez les axes (Étape 4) et les questions (Étape 5). Matrice : cochez les questions à afficher pour chaque axe.</p>
                ${await this.renderQuestionMatrix(axes)}
            </section>
        </div>`;
    },

    // ========== QUESTION MATRIX (Chantier 3) ==========
    async renderQuestionMatrix(axes) {
        let allMetrics = [];
        let links = [];
        try { allMetrics = await DB.getAllMetrics() || []; } catch(e) { console.warn("getAllMetrics failed, using fallback"); }
        try { links = await DB.getAllMetricAxeLinks() || []; } catch(e) { console.warn("getAllMetricAxeLinks failed"); }

        if (!axes || axes.length === 0) return '<div class="info-box">Aucun axe configuré. Ajoutez des axes ci-dessous.</div>' + this.renderAxeManager(axes);

        const isLinked = (metricId, axeCode) => links.some(l => l.metric_id === metricId && l.axe_code === axeCode);

        return `
            ${allMetrics.length > 0 ? `
            <div class="table-responsive" style="margin:20px 0">
                <table class="financial-table matrix-table">
                    <thead><tr>
                        <th style="min-width:200px">Question</th><th>Type</th>
                        ${axes.map(a => `<th class="axe-header"><div>${a.code} — ${a.principal}</div></th>`).join('')}
                        <th></th>
                    </tr></thead>
                    <tbody>${allMetrics.map(m => `<tr>
                        <td style="font-size:0.85rem">${m.label}</td>
                        <td><span class="type-tag">${m.input_type}</span></td>
                        ${axes.map(a => `<td style="text-align:center">
                            <input type="checkbox" class="matrix-check" data-metric="${m.id}" data-axe="${a.code}" ${isLinked(m.id, a.code)?'checked':''} onchange="ADMIN.toggleLink('${m.id}','${a.code}',this.checked)">
                        </td>`).join('')}
                        <td><button class="btn-delete" onclick="ADMIN.deleteMetric('${m.id}')"><i class="fas fa-trash-alt"></i></button></td>
                    </tr>`).join('')}</tbody>
                </table>
            </div>` : '<div class="info-box">Aucune question configurée. Ajoutez-en ci-dessous.</div>'}

            <div class="grid-2" style="margin-top:20px">
                <div class="card" style="background:#f8fafc">
                    <h5>Ajouter une question</h5>
                    <div class="mini-form">
                        <input type="text" id="new-metric-label" placeholder="Ex: Nombre d'enfants accueillis">
                        <select id="new-metric-type"><option value="number">Nombre</option><option value="text">Texte libre</option><option value="date">Date</option><option value="time">Horaires</option></select>
                        <button class="btn btn-primary" onclick="ADMIN.addMetric()">Ajouter</button>
                    </div>
                </div>
                ${this.renderAxeManager(axes)}
            </div>`;
    },

    renderAxeManager(axes) {
        return `<div class="card" style="background:#f8fafc">
            <h5>Gérer les axes</h5>
            <div class="config-list" style="max-height:200px;overflow-y:auto;margin-bottom:10px">
                ${(axes||[]).map(a => `<div class="config-item" style="padding:8px 12px;font-size:0.85rem">
                    <span class="axe-code">${a.code}</span><span style="flex:1">${a.principal}</span>
                    <button class="btn-delete" onclick="ADMIN.deleteAxe('${a.code}')"><i class="fas fa-times"></i></button>
                </div>`).join('')||'<p style="color:#94a3b8;font-size:0.85rem">Aucun axe</p>'}
            </div>
            <div class="mini-form">
                <input type="text" id="new-axe-code" placeholder="Code (5a)">
                <input type="text" id="new-axe-label" placeholder="Nom principal">
                <input type="text" id="new-axe-secondary" placeholder="Sous-nom">
                <button class="btn btn-primary btn-sm" onclick="ADMIN.addAxe()">Ajouter l'axe</button>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="ADMIN.loadDefaultAxes()" style="margin-top:10px;width:100%"><i class="fas fa-sync"></i> Charger axes par défaut</button>
        </div>`;
    },

    async toggleLink(metricId, axeCode, enabled) {
        try { await DB.toggleMetricAxe(metricId, axeCode, enabled); }
        catch(e) { UI.notify(e.message, "error"); }
    },

    async addAxe() {
        const code = document.getElementById('new-axe-code').value;
        const label = document.getElementById('new-axe-label').value;
        const secondary = document.getElementById('new-axe-secondary').value;
        if (!code || !label) return UI.notify("Code et nom requis.", "error");
        UI.toggleLoader(true);
        try { await sb.from('form_axes').insert([{ code, principal: label, secondary }]); UI.notify("Axe ajouté.", "success"); UI.switchView('admin-dashboard'); }
        catch(e) { UI.notify(e.message, "error"); } finally { UI.toggleLoader(false); }
    },

    async loadDefaultAxes() {
        if (!confirm("Charger les axes par défaut ?")) return;
        UI.toggleLoader(true);
        try { await sb.from('form_axes').upsert(EXCEL_MAPPING.axes, { onConflict: 'code' }); UI.notify("Axes chargés.", "success"); UI.switchView('admin-dashboard'); }
        catch(e) { UI.notify(e.message, "error"); } finally { UI.toggleLoader(false); }
    },

    async deleteAxe(code) {
        if (!confirm("Supprimer cet axe et ses liaisons ?")) return;
        UI.toggleLoader(true);
        try { await sb.from('form_axes').delete().eq('code', code); UI.notify("Axe supprimé.", "success"); UI.switchView('admin-dashboard'); }
        catch(e) { UI.notify(e.message, "error"); } finally { UI.toggleLoader(false); }
    },

    async addMetric() {
        const label = document.getElementById('new-metric-label').value;
        const type = document.getElementById('new-metric-type').value;
        if (!label) return UI.notify("Intitulé requis.", "error");
        UI.toggleLoader(true);
        try {
            const key = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
            await DB.addMetric(label, type, key);
            UI.notify("Question ajoutée.", "success"); UI.switchView('admin-dashboard');
        } catch(e) { UI.notify(e.message, "error"); } finally { UI.toggleLoader(false); }
    },

    async deleteMetric(id) {
        if (!confirm("Supprimer cette question ?")) return;
        UI.toggleLoader(true);
        try { await DB.deleteMetric(id); UI.notify("Supprimée.", "success"); UI.switchView('admin-dashboard'); }
        catch(e) { UI.notify(e.message, "error"); } finally { UI.toggleLoader(false); }
    },

    // ========== DOSSIER DETAIL + ANALYSIS (Chantier 8) ==========
    async renderDossierDetail(appId) {
        if (!appId) return '<div class="error-state card">ID de dossier manquant.</div>';
        UI.toggleLoader(true);
        try {
            const full = await DB.getFullApplication(appId);
            const assoc = full.associations || {};
            const financials = full.financials || [];
            const bilanData = full.snapshot_bilan || assoc.bilan_data || {};
            const bilanArray = Object.entries(bilanData).map(([code, vals]) => ({ account_code: code, ...vals }));
            const analysis = UTILS.calculateRatios(financials, bilanArray, 'cr_n1');
            const riskScore = UTILS.calculateGlobalRiskScore(analysis.ratios);
            const riskLabel = UTILS.getGlobalRiskLabel(riskScore);
            const messages = await DB.getMessages(appId) || [];
            const statusLabels = { draft:'Brouillon', submitted:'Soumise', validated:'Validée', refused:'Refusée' };

            const renderRisk = (label, type, value, unit='') => {
                const r = UTILS.getRiskLevel(type, value);
                return `<div class="risk-item"><label>${label}</label><span class="badge ${r.cls}">${value}${unit} — ${r.label}</span></div>`;
            };

            return `<div class="admin-detail-view">
                <div class="header-actions">
                    <button class="btn" onclick="UI.switchView('admin-dashboard')">← Retour</button>
                    <div style="display:flex;gap:10px;align-items:center">
                        <select id="status-select" onchange="ADMIN.updateStatus('${appId}',this.value)" style="padding:8px;border-radius:8px;border:1px solid #cbd5e1">
                            ${['draft','submitted','validated','refused','frozen'].map(s => `<option value="${s}" ${full.status===s?'selected':''}>${statusLabels[s]||s}</option>`).join('')}
                        </select>
                        <button class="btn btn-primary" style="width:auto" onclick="ADMIN.downloadDossierPDF('${appId}')"><i class="fas fa-file-pdf"></i> PDF</button>
                    </div>
                </div>

                <div class="grid-2">
                    <section class="card"><h3>Identité & Demande</h3>
                        <p><strong>Association :</strong> ${assoc.name||'N/A'}</p>
                        <p><strong>SIRET :</strong> ${assoc.siret||'N/A'}</p>
                        <p><strong>Axe :</strong> ${full.selected_axe||'N/A'}</p>
                        <p class="highlight"><strong>Montant demandé :</strong> ${(full.total_requested||0).toLocaleString('fr-FR')} €</p>
                    </section>
                    <section class="card"><h3>${riskLabel.icon} Risque Global : ${riskScore}/100</h3>
                        <div style="background:${riskScore<=25?'#dcfce7':riskScore<=50?'#fef3c7':riskScore<=75?'#fed7aa':'#fee2e2'};padding:15px;border-radius:8px;text-align:center;font-size:1.2rem;font-weight:700;margin-bottom:15px">${riskLabel.label}</div>
                        <div class="risk-indicators">
                            ${renderRisk('Trésorerie (jours)', 'treasuryDaysRaw', analysis.ratios.treasuryDaysRaw, 'j')}
                            ${renderRisk('Trésorerie ajustée', 'treasuryDaysAdjusted', analysis.ratios.treasuryDaysAdjusted, 'j')}
                            ${renderRisk('Autonomie financière', 'financialAutonomy', analysis.ratios.financialAutonomy, '%')}
                            ${renderRisk('Dépendance CCMVR', 'ccmvrDependence', analysis.ratios.ccmvrDependence, '%')}
                        </div>
                    </section>
                </div>

                <section class="card"><h3>📊 Soldes Intermédiaires de Gestion (SIG)</h3>
                    <div class="table-responsive"><table class="financial-table">
                        <thead><tr><th>Indicateur</th><th>Montant (N-1)</th></tr></thead>
                        <tbody>
                            <tr><td>Total Produits</td><td style="text-align:right">${UTILS.formatCurrency(analysis.sig.totalProduits)}</td></tr>
                            <tr><td>Total Charges</td><td style="text-align:right">${UTILS.formatCurrency(analysis.sig.totalCharges)}</td></tr>
                            <tr><td><strong>Valeur Ajoutée</strong></td><td style="text-align:right"><strong>${UTILS.formatCurrency(analysis.sig.valeurAjoutee)}</strong></td></tr>
                            <tr><td><strong>Excédent Brut d'Exploitation (EBE)</strong></td><td style="text-align:right"><strong>${UTILS.formatCurrency(analysis.sig.ebe)}</strong></td></tr>
                            <tr><td>Résultat d'exploitation</td><td style="text-align:right">${UTILS.formatCurrency(analysis.sig.resultatExploitation)}</td></tr>
                            <tr><td>Résultat courant</td><td style="text-align:right">${UTILS.formatCurrency(analysis.sig.resultatCourant)}</td></tr>
                            <tr class="total-row"><td><strong>Résultat Net</strong></td><td style="text-align:right"><strong>${UTILS.formatCurrency(analysis.sig.resultatNet)}</strong></td></tr>
                            <tr><td><strong>CAF</strong></td><td style="text-align:right"><strong>${UTILS.formatCurrency(analysis.sig.caf)}</strong></td></tr>
                        </tbody>
                    </table></div>
                </section>

                <section class="card"><h3>📈 Ratios détaillés</h3>
                    <div class="risk-indicators">
                        ${renderRisk('Couverture charges par produits propres', 'coverageRate', analysis.ratios.coverageRate, '%')}
                        ${renderRisk('Part charges de personnel', 'personalExpenseRate', analysis.ratios.personalExpenseRate, '%')}
                        ${renderRisk('Dépendance aux subventions', 'subsidyDependence', analysis.ratios.subsidyDependence, '%')}
                        ${renderRisk('Solvabilité', 'solvabilityRatio', analysis.ratios.solvabilityRatio, '')}
                        ${renderRisk('Fonds de roulement', 'fondsRoulement', analysis.ratios.fondsRoulement, ' €')}
                        ${renderRisk('BFR', 'fondsRoulement', analysis.ratios.bfr, ' €')}
                        ${renderRisk('Trésorerie nette', 'tresorerieNette', analysis.ratios.tresorerieNette, ' €')}
                        ${renderRisk('CAF', 'caf', analysis.ratios.caf, ' €')}
                    </div>
                </section>

                <section class="card"><h3><i class="fas fa-comments"></i> Messagerie interne</h3>
                    <div class="messages-list" style="max-height:300px;overflow-y:auto;margin-bottom:15px">
                        ${messages.map(m => `<div class="message-item ${m.sender_role}-message">
                            <div class="message-meta"><i class="fas ${m.sender_role==='admin'?'fa-user-shield':'fa-user'}"></i> ${m.sender_role==='admin'?'Admin':'Association'} — ${new Date(m.created_at).toLocaleString('fr-FR')}</div>
                            <div class="message-content">${m.content}</div>
                        </div>`).join('')||'<p style="color:#94a3b8">Aucun message</p>'}
                    </div>
                    <div style="display:flex;gap:10px">
                        <textarea id="admin-message" rows="2" placeholder="Écrire un message à l'association..." style="flex:1;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-family:inherit"></textarea>
                        <button class="btn btn-primary" style="width:auto" onclick="ADMIN.sendAdminMessage('${appId}')"><i class="fas fa-paper-plane"></i></button>
                    </div>
                </section>
            </div>`;
        } catch(err) { return `<div class="error-state card"><h3>Erreur</h3><p>${err.message}</p><button class="btn" onclick="UI.switchView('admin-dashboard')">← Retour</button></div>`; }
        finally { UI.toggleLoader(false); }
    },

    async sendAdminMessage(appId) {
        const el = document.getElementById('admin-message');
        if (!el || !el.value.trim()) return;
        try { await DB.sendMessage(appId, 'admin', el.value.trim()); UI.notify("Message envoyé.", "success"); UI.switchView('admin-view-dossier', appId); }
        catch(e) { UI.notify(e.message, "error"); }
    },

    async updateStatus(appId, newStatus) {
        UI.toggleLoader(true);
        try {
            await sb.from('grant_applications').update({ status: newStatus }).eq('id', appId);
            UI.notify(`Statut → ${newStatus}`, "success");
        } catch(e) { UI.notify(e.message, "error"); }
        finally { UI.toggleLoader(false); }
    },

    async downloadDossierPDF(appId) {
        UI.notify("Génération PDF...", "info");
        const full = await DB.getFullApplication(appId);
        full.association = full.associations;
        await PDF.generate(full);
    },

    // ========== INSTRUCTION TABLE (Chantier 9) ==========
    async renderInstructionTable() {
        const applications = await DB.getAllApplications();
        const apps = applications.filter(a => a.status !== 'draft');
        const statusLabels = { submitted:'Soumise', validated:'Validée', refused:'Refusée', frozen:'Figée' };

        return `<div class="card" style="max-width:100%">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
                <h3 style="margin:0"><i class="fas fa-table"></i> Tableau d'instruction</h3>
                <div style="display:flex;gap:10px">
                    <button class="btn btn-secondary" style="width:auto" onclick="UI.switchView('admin-dashboard')">← Retour</button>
                    <button class="btn btn-primary" style="width:auto" onclick="ADMIN.exportExcel()"><i class="fas fa-file-excel"></i> Exporter Excel</button>
                </div>
            </div>
            <div class="table-responsive"><table class="financial-table instruction-table" id="instruction-table">
                <thead><tr>
                    <th>Association</th><th>Axe</th><th>Demandé</th><th>Statut</th>
                    <th>Instruit ✓</th><th>Commentaire</th><th>Proposition instructeur</th>
                    <th>Subv. commission</th><th>Subv. except. fonct.</th><th>Subv. finale votée</th><th>Validé ✓</th><th></th>
                </tr></thead>
                <tbody>${apps.map(app => `<tr data-app-id="${app.id}">
                    <td style="font-weight:600;white-space:nowrap">${app.associations?.name||'?'}</td>
                    <td>${app.selected_axe||'-'}</td>
                    <td style="text-align:right">${(app.total_requested||0).toLocaleString('fr-FR')} €</td>
                    <td><span class="badge">${statusLabels[app.status]||app.status}</span></td>
                    <td style="text-align:center"><input type="checkbox" class="instr-check" data-id="${app.id}" data-field="instructor_validated" ${app.instructor_validated?'checked':''}></td>
                    <td><input type="text" class="instr-text" data-id="${app.id}" data-field="instructor_comment" value="${app.instructor_comment||''}" placeholder="..." style="width:120px"></td>
                    <td><input type="number" class="instr-num" data-id="${app.id}" data-field="instructor_proposal" value="${app.instructor_proposal||0}" style="width:90px"></td>
                    <td><input type="number" class="instr-num" data-id="${app.id}" data-field="commission_proposal" value="${app.commission_proposal||0}" style="width:90px"></td>
                    <td><input type="number" class="instr-num" data-id="${app.id}" data-field="exceptional_grant" value="${app.exceptional_grant||0}" style="width:90px"></td>
                    <td><input type="number" class="instr-num" data-id="${app.id}" data-field="final_voted" value="${app.final_voted||0}" style="width:90px"></td>
                    <td style="text-align:center"><input type="checkbox" class="instr-final" data-id="${app.id}" data-field="final_validated" ${app.final_validated?'checked':''}></td>
                    <td><button class="btn btn-icon" onclick="UI.switchView('admin-view-dossier','${app.id}')"><i class="fas fa-eye"></i></button></td>
                </tr>`).join('')||'<tr><td colspan="12">Aucun dossier</td></tr>'}</tbody>
            </table></div>
        </div>`;
    },

    initInstructionEvents() {
        // Auto-save on change for instruction table
        document.querySelectorAll('.instr-check, .instr-text, .instr-num, .instr-final').forEach(el => {
            const evt = el.type === 'checkbox' ? 'change' : 'blur';
            el.addEventListener(evt, async (e) => {
                const id = e.target.dataset.id, field = e.target.dataset.field;
                const value = e.target.type === 'checkbox' ? e.target.checked : (e.target.type === 'number' ? parseFloat(e.target.value)||0 : e.target.value);
                try {
                    const update = { [field]: value };
                    // If final_validated is checked, also set status to validated
                    if (field === 'final_validated' && value === true) update.status = 'validated';
                    await sb.from('grant_applications').update(update).eq('id', id);
                } catch(err) { UI.notify("Erreur sauvegarde: " + err.message, "error"); }
            });
        });
    },

    async exportExcel() {
        if (typeof XLSX === 'undefined') return UI.notify("Bibliothèque Excel non chargée.", "error");
        UI.toggleLoader(true);
        try {
            const apps = (await DB.getAllApplications()).filter(a => a.status !== 'draft');
            const rows = [];
            for (const app of apps) {
                const full = await DB.getFullApplication(app.id);
                const bilanData = full.snapshot_bilan || full.associations?.bilan_data || {};
                const bilanArray = Object.entries(bilanData).map(([code, vals]) => ({ account_code: code, ...vals }));
                const analysis = UTILS.calculateRatios(full.financials||[], bilanArray, 'cr_n1');
                const riskScore = UTILS.calculateGlobalRiskScore(analysis.ratios);
                rows.push({
                    'Association': app.associations?.name||'',
                    'Axe': app.selected_axe||'',
                    'Année': app.year,
                    'Montant demandé': app.total_requested||0,
                    'Statut': app.status,
                    'Instruit': app.instructor_validated?'Oui':'Non',
                    'Commentaire': app.instructor_comment||'',
                    'Proposition instructeur': app.instructor_proposal||0,
                    'Subv. commission': app.commission_proposal||0,
                    'Subv. except.': app.exceptional_grant||0,
                    'Subv. finale votée': app.final_voted||0,
                    'Validé final': app.final_validated?'Oui':'Non',
                    'VA': analysis.sig.valeurAjoutee,
                    'EBE': analysis.sig.ebe,
                    'Résultat Net': analysis.sig.resultatNet,
                    'CAF': analysis.sig.caf,
                    'Trésorerie (jours)': analysis.ratios.treasuryDaysRaw,
                    'Autonomie fin. %': analysis.ratios.financialAutonomy,
                    'Dépendance CCMVR %': analysis.ratios.ccmvrDependence,
                    'Score risque /100': riskScore
                });
            }
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Instruction");
            XLSX.writeFile(wb, `Instruction_CCMVR_${CONFIG.CURRENT_YEAR}.xlsx`);
            UI.notify("Export Excel terminé.", "success");
        } catch(e) { UI.notify("Erreur export: " + e.message, "error"); }
        finally { UI.toggleLoader(false); }
    }
};
