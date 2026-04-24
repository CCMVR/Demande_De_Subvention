/**
 * Logic for the multi-step Grant Application Form
 */
const FORM = {
    currentStep: 1,
    data: {
        application: { 
            year: 2026, 
            status: 'draft', 
            application_type: 'globale', 
            selected_axe: null, 
            total_requested: 0 
        },
        association: {},
        financials: [],
        metrics: {}
    },

    // Dynamic config fetched or mapped
    config: {
        axes: [],
        metrics: []
    },

    async init() {
        UI.toggleLoader(true);
        // RESET DATA TO DEFAULTS IMMEDIATELY
        this.resetData();

        try {
            // Load Dynamic Config from DB
            this.config.axes = await DB.getFormAxes() || [];
            
            // Load existing draft if any (Safety: Ensure association exists)
            if (STATE.association && STATE.association.id) {
                const apps = await DB.getApplicationsByAssoc(STATE.association.id);
                const draft = apps.find(a => a.status === 'draft' && a.year === 2026);
                if (draft) {
                    const full = await DB.getFullApplication(draft.id);
                    if (full && full.id) {
                        this.data = full;
                        console.log("Form: Loaded draft", full.id);
                    }
                }
            }
        } catch (err) {
            console.error("Form init error", err);
        } finally {
            UI.toggleLoader(false);
        }
    },

    async deleteApplication(appId) {
        if (!confirm("Voulez-vous vraiment supprimer définitivement ce brouillon ?")) return;
        
        UI.toggleLoader(true);
        try {
            await DB.deleteApplication(appId);
            UI.notify("Demande supprimée.", "success");
            UI.switchView('dashboard');
        } catch (err) {
            UI.notify("Erreur lors de la suppression.", "error");
        } finally {
            UI.toggleLoader(false);
        }
    },

    resetData() {
        this.data = {
            application: { 
                year: 2026, 
                status: 'draft', 
                application_type: 'globale', 
                selected_axe: null, 
                total_requested: 0 
            },
            association: {},
            financials: [],
            metrics: {}
        };
        this.initDefaultFinancials();
    },

    initDefaultFinancials() {
        const accounts = EXCEL_MAPPING.financial_accounts;
        this.data.financials = accounts.map(acc => ({
            account_code: acc.code,
            label: acc.label,
            type: acc.code.startsWith('6') ? 'expense' : 'revenue',
            bp_year: 0, cr_n1: 0, cr_n2: 0, cr_n3: 0
        }));
    },

    async renderStep(step) {
        try {
            this.currentStep = step;
            const container = document.getElementById('step-content');
            
            document.querySelectorAll('.step-badge').forEach((b, idx) => {
                b.classList.toggle('active', idx + 1 === step);
                b.classList.toggle('completed', idx + 1 < step);
            });

            let html = '';
            switch(step) {
                case 1: html = this.tplNotice(); break;
                case 2: html = this.tplType(); break;
                case 3: html = this.tplIdentity(); break;
                case 4: html = this.tplAxes(); break;
                case 5: html = await this.tplDetails(); break;
                case 6: html = this.tplFinancials('expense'); break;
                case 7: html = this.tplFinancials('revenue'); break;
                case 8: html = this.tplBilan(); break;
                case 9: html = this.tplDeclarations(); break;
            }
            
            if (!html) throw new Error("Le contenu de l'étape est vide.");
            
            container.innerHTML = html;
            this.bindEvents();
        } catch (err) {
            console.error("Render Step Error:", err);
            UI.notify("Erreur lors de l'affichage de l'étape " + step, "error");
        }
    },

    tplNotice() {
        return `
            <div class="form-step">
                <h3>Notice d'utilisation</h3>
                <div class="info-box">
                    <p>Bienvenue dans le portail de demande de subvention CCMVR.</p>
                    <p>Les cases grisées comportent des calculs automatiques. Les cases vertes dans votre ancien Excel sont ici des champs de saisie blancs.</p>
                </div>
                <div class="form-actions">
                    <button class="btn btn-primary" onclick="FORM.renderStep(2)">Démarrer</button>
                </div>
            </div>
        `;
    },

    tplType() {
        const types = [
            { id: 'globale', label: 'Demande de fonctionnement globale' },
            { id: 'projet', label: 'Demande de fonctionnement sur projet' },
            { id: 'exceptionnelle', label: 'Demande exceptionnelle' },
            { id: 'investissement', label: "Demande d'investissement" }
        ];
        
        return `
            <div class="form-step">
                <h3>Type de demande</h3>
                <p class="help-text">Veuillez sélectionner la nature de votre demande de subvention.</p>
                <div class="type-selection grid-2">
                    ${types.map(t => `
                        <label class="type-option card luxe ${this.data.application.application_type === t.id ? 'active' : ''}">
                            <input type="radio" name="app-type" value="${t.id}" ${this.data.application.application_type === t.id ? 'checked' : ''} onchange="FORM.data.application.application_type = this.value; FORM.renderStep(2)">
                            <div class="type-info">
                                <strong>${t.label}</strong>
                            </div>
                        </label>
                    `).join('')}
                </div>
                <div class="form-actions">
                    <button class="btn" onclick="FORM.renderStep(1)">Précédent</button>
                    <button class="btn btn-primary" onclick="FORM.saveAndNext(3)">Suivant</button>
                </div>
            </div>
        `;
    },

    tplIdentity() {
        const assoc = STATE.association || {};
        return `
            <div class="form-step">
                <h3>Fiche Identité</h3>
                <div class="grid-2">
                    <div class="input-group">
                        <label>Nom de l'association</label>
                        <input type="text" id="f-name" value="${assoc.name || ''}" placeholder="Ex: ACIJA">
                    </div>
                    <div class="input-group">
                        <label>SIRET</label>
                        <input type="text" id="f-siret" value="${assoc.siret || ''}">
                    </div>
                    <div class="input-group">
                        <label>Mail de contact</label>
                        <input type="email" id="f-email" value="${assoc.contact_email || ''}">
                    </div>
                    <div class="input-group highlight">
                        <label>Subvention demandée (€)</label>
                        <input type="number" id="f-requested" value="${this.data.application.total_requested || 0}">
                        <small>Ce montant sera reporté automatiquement à la ligne 74 (Recettes).</small>
                    </div>
                </div>
                <div class="form-actions">
                    <button class="btn" onclick="FORM.renderStep(1)">Précédent</button>
                    <button class="btn btn-primary" onclick="FORM.saveAndNext(3)">Suivant</button>
                </div>
            </div>
        `;
    },

    tplIdentity() {
        const assoc = STATE.association || {};
        return `
            <div class="form-step">
                <h3>Fiche Identité</h3>
                <div class="grid-2">
                    <div class="input-group">
                        <label>Nom de l'association</label>
                        <input type="text" id="f-name" value="${assoc.name || ''}" placeholder="Ex: ACIJA">
                    </div>
                    <div class="input-group">
                        <label>SIRET</label>
                        <input type="text" id="f-siret" value="${assoc.siret || ''}">
                    </div>
                    <div class="input-group">
                        <label>Mail de contact</label>
                        <input type="email" id="f-email" value="${assoc.contact_email || ''}">
                    </div>
                    <div class="input-group highlight">
                        <label>Subvention demandée (€)</label>
                        <input type="number" id="f-requested" value="${this.data.application.total_requested || 0}">
                        <small>Ce montant sera reporté automatiquement à la ligne 74 (Recettes).</small>
                    </div>
                </div>
                <div class="form-actions">
                    <button class="btn" onclick="FORM.renderStep(2)">Précédent</button>
                    <button class="btn btn-primary" onclick="FORM.saveAndNext(4)">Suivant</button>
                </div>
            </div>
        `;
    },

    tplAxes() {
        const axes = this.config.axes.length > 0 ? this.config.axes : EXCEL_MAPPING.axes;
        return `
            <div class="form-step">
                <h3>Axe de la demande</h3>
                <p class="help-text">Veuillez cocher une seule case. Pour un deuxième axe, créez une autre demande.</p>
                <div class="axes-selection">
                    ${axes.map(axe => `
                        <label class="axe-option">
                            <input type="radio" name="axe" value="${axe.code}" ${this.data.application.selected_axe === axe.code ? 'checked' : ''}>
                            <div class="axe-info">
                                <strong>${axe.principal}</strong>
                                <span>${axe.secondary || ''}</span>
                            </div>
                        </label>
                    `).join('')}
                </div>
                <div class="form-actions">
                    <button class="btn" onclick="FORM.renderStep(3)">Précédent</button>
                    <button class="btn btn-primary" onclick="FORM.saveAndNext(5)">Suivant</button>
                </div>
            </div>
        `;
    },

    async tplDetails() {
        const axeCode = this.data.application.selected_axe;
        if (!axeCode) return `<div class="error-state">Veuillez sélectionner un axe à l'étape précédente.</div>`;
        
        UI.toggleLoader(true);
        const metrics = await DB.getAxeMetrics(axeCode);
        UI.toggleLoader(false);

        return `
            <div class="form-step">
                <h3>Détails de l'activité - Axe ${axeCode}</h3>
                <div class="grid-2">
                    ${metrics.map(m => `
                        <div class="input-group">
                            <label>${m.label}</label>
                            <input type="${m.input_type}" class="metric-input" data-key="${m.metric_key}" value="${this.data.metrics[m.metric_key] || ''}">
                        </div>
                    `).join('') || '<p>Aucune question spécifique pour cet axe.</p>'}
                </div>
                <div class="form-actions">
                    <button class="btn" onclick="FORM.renderStep(4)">Précédent</button>
                    <button class="btn btn-primary" onclick="FORM.saveAndNext(6)">Suivant</button>
                </div>
            </div>
        `;
    },

    tplFinancials(type) {
        const title = type === 'expense' ? 'Section 1 : CHARGES' : 'Section 2 : RECETTES';
        const rows = this.data.financials.filter(f => f.type === type);
        
        return `
            <div class="form-step wide">
                <h3>${title}</h3>
                <div class="table-responsive">
                    <table class="financial-table">
                        <thead>
                            <tr>
                                <th>Compte</th>
                                <th>Libellé</th>
                                <th>BP 2026</th>
                                <th>CR 2025</th>
                                <th>CR 2024</th>
                                <th>Evolution %</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(row => `
                                <tr>
                                    <td>${row.account_code}</td>
                                    <td>${row.label}</td>
                                    <td><input type="number" class="calc-input" data-code="${row.account_code}" data-field="bp_year" value="${row.bp_year}"></td>
                                    <td><input type="number" class="calc-input" data-code="${row.account_code}" data-field="cr_n1" value="${row.cr_n1}"></td>
                                    <td><input type="number" class="calc-input" data-code="${row.account_code}" data-field="cr_n2" value="${row.cr_n2}"></td>
                                    <td class="readonly-cell">${UTILS.calculateEvolution(row.bp_year, row.cr_n1)}%</td>
                                </tr>
                            `).join('')}
                            <tr class="total-row">
                                <td colspan="2">TOTAL ${title}</td>
                                <td id="total-bp">0</td>
                                <td id="total-n1">0</td>
                                <td id="total-n2">0</td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="form-actions">
                    <button class="btn" onclick="FORM.renderStep(${type === 'expense' ? 5 : 6})">Précédent</button>
                    <button class="btn btn-primary" onclick="FORM.saveAndNext(${type === 'expense' ? 7 : 8})">Suivant</button>
                </div>
            </div>
        `;
    },

    tplBilan() {
        return `
            <div class="form-step wide">
                <h3>Bilan Simplifié</h3>
                <div class="grid-2">
                    <div class="card">
                        <h4>ACTIF (Ce que l'on possède)</h4>
                        <div class="input-group">
                            <label>Immobilisations (Bâtiments, matériel...)</label>
                            <input type="number" class="bilan-input" data-key="actif_immo" value="${this.data.application.actif_immo || 0}">
                        </div>
                        <div class="input-group">
                            <label>Disponibilités (Argent en banque/caisse)</label>
                            <input type="number" class="bilan-input" data-key="actif_dispo" value="${this.data.application.actif_dispo || 0}">
                        </div>
                        <div class="input-group">
                            <label>Créances clients et autres</label>
                            <input type="number" class="bilan-input" data-key="actif_creances" value="${this.data.application.actif_creances || 0}">
                        </div>
                    </div>
                    <div class="card">
                        <h4>PASSIF (D'où vient l'argent)</h4>
                        <div class="input-group">
                            <label>Fonds propres (Fonds asso, réserves, report à nouveau)</label>
                            <input type="number" class="bilan-input" data-key="passif_fonds" value="${this.data.application.passif_fonds || 0}">
                        </div>
                        <div class="input-group">
                            <label>Résultat de l'exercice</label>
                            <input type="number" class="bilan-input" data-key="passif_resultat" value="${this.data.application.passif_resultat || 0}">
                        </div>
                        <div class="input-group">
                            <label>Fonds dédiés (Subventions fléchées non utilisées)</label>
                            <input type="number" class="bilan-input" data-key="passif_dedies" value="${this.data.application.passif_dedies || 0}">
                        </div>
                        <div class="input-group">
                            <label>Dettes (Fournisseurs, fiscales, sociales)</label>
                            <input type="number" class="bilan-input" data-key="passif_dettes" value="${this.data.application.passif_dettes || 0}">
                        </div>
                    </div>
                </div>
                <div class="form-actions">
                    <button class="btn" onclick="FORM.renderStep(7)">Précédent</button>
                    <button class="btn btn-primary" onclick="FORM.saveAndNext(9)">Suivant</button>
                </div>
            </div>
        `;
    },

    tplDeclarations() {
        return `
            <div class="form-step">
                <h3>Déclarations et Signature</h3>
                <div class="info-box">
                    <p>En cochant ces cases, vous certifiez sur l'honneur l'exactitude des informations fournies.</p>
                </div>
                <div class="declarations-list">
                    <label class="check-item luxe">
                        <input type="checkbox" id="decl-1" required>
                        <div class="check-text">
                            <strong>Obligations administratives</strong>
                            L'association est à jour de ses obligations administratives, comptables, sociales et fiscales.
                        </div>
                    </label>
                    <label class="check-item luxe">
                        <input type="checkbox" id="decl-2" required>
                        <div class="check-text">
                            <strong>Contrat d'engagement républicain</strong>
                            L'association souscrit au contrat d'engagement républicain (loi n° 2000-321).
                        </div>
                    </label>
                    <label class="check-item luxe">
                        <input type="checkbox" id="decl-3" required>
                        <div class="check-text">
                            <strong>Charte des engagements réciproques</strong>
                            L'association respecte les principes de la Charte des engagements réciproques du 14 février 2014.
                        </div>
                    </label>
                </div>
                <div class="form-actions">
                    <button class="btn" onclick="FORM.renderStep(8)">Précédent</button>
                    <button class="btn btn-primary" id="final-submit" onclick="FORM.submitApplication()">Soumettre la demande</button>
                </div>
            </div>
        `;
    },

    bindEvents() {
        // Sync requested amount from Identity step
        const requestedInput = document.getElementById('f-requested');
        if (requestedInput) {
            requestedInput.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value) || 0;
                this.data.application.total_requested = val;
                
                // Propagate to financials (account 74: Subvention demandée)
                const rec = this.data.financials.find(f => f.account_code === '74');
                if (rec) rec.bp_year = val;
            });
        }

        // Sync financial inputs to local data and trigger totals
        document.querySelectorAll('.calc-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const code = e.target.dataset.code;
                const field = e.target.dataset.field;
                const val = parseFloat(e.target.value) || 0;
                
                const rec = this.data.financials.find(f => f.account_code === code);
                if (rec) {
                    rec[field] = val;
                    // Sync requested amount if it's the CCMVR subvention line (code 74)
                    if (code === '74' && field === 'bp_year') {
                        this.data.application.total_requested = val;
                    }
                }
                this.updateStepTotals();
            });
        });

        // Sync metric inputs
        document.querySelectorAll('.metric-input').forEach(input => {
            input.addEventListener('change', (e) => {
                this.data.metrics[e.target.dataset.key] = e.target.value;
            });
        });

        // Initialize totals on load
        if (this.currentStep === 6 || this.currentStep === 7) {
            this.updateStepTotals();
        }
    },

    updateStepTotals() {
        const type = this.currentStep === 6 ? 'expense' : 'revenue';
        const rows = this.data.financials.filter(f => f.type === type);
        
        const bpTotal = rows.reduce((sum, r) => sum + (parseFloat(r.bp_year) || 0), 0);
        const n1Total = rows.reduce((sum, r) => sum + (parseFloat(r.cr_n1) || 0), 0);
        const n2Total = rows.reduce((sum, r) => sum + (parseFloat(r.cr_n2) || 0), 0);

        document.getElementById('total-bp').textContent = bpTotal.toLocaleString() + ' €';
        document.getElementById('total-n1').textContent = n1Total.toLocaleString() + ' €';
        document.getElementById('total-n2').textContent = n2Total.toLocaleString() + ' €';
    },

    async saveAndNext(nextStep) {
        if (!STATE.association) return this.renderStep(nextStep);

        UI.toggleLoader(true);
        try {
            // 1. Save or Update Application
            const app = {
                ...this.data.application,
                association_id: STATE.association.id
            };
            
            let res;
            if (this.data.application.id) {
                res = await sb.from('grant_applications').update(app).eq('id', this.data.application.id).select().single();
            } else {
                res = await sb.from('grant_applications').insert([app]).select().single();
                this.data.application.id = res.data.id;
            }

            if (res.error) throw res.error;

            // 2. Save Financials (Batch)
            if (this.currentStep === 6 || this.currentStep === 7) {
                const finData = this.data.financials.map(f => ({
                    ...f,
                    application_id: this.data.application.id
                }));
                const { error: finErr } = await sb.from('financial_records').upsert(finData, { onConflict: 'application_id, account_code' });
                if (finErr) throw finErr;
            }

            UI.notify("Progrès enregistré.", "success");
            this.renderStep(nextStep);
        } catch (err) {
            UI.notify("Erreur lors de la sauvegarde : " + err.message, "error");
            this.renderStep(nextStep); // Continue anyway for testing
        } finally {
            UI.toggleLoader(false);
        }
    },

    async submitApplication() {
        if (!confirm("Voulez-vous vraiment soumettre votre demande ? Elle ne sera plus modifiable.")) return;

        UI.toggleLoader(true);
        try {
            const { error } = await sb.from('grant_applications')
                .update({ status: 'submitted' })
                .eq('id', this.data.application.id);
            
            if (error) throw error;
            
            UI.notify("Demande soumise avec succès !", "success");
            UI.switchView('dashboard');
        } catch (err) {
            UI.notify(err.message, "error");
        } finally {
            UI.toggleLoader(false);
        }
    }
};
