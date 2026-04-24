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
                        // NORMALIZE DATA STRUCTURE
                        this.data.application = { ...full };
                        this.data.financials = full.financials || [];
                        
                        // Convert metrics array to object
                        this.data.metrics = {};
                        if (Array.isArray(full.metrics)) {
                            full.metrics.forEach(m => {
                                this.data.metrics[m.metric_key] = m.value;
                            });
                        }

                        // Clean up the application object
                        delete this.data.application.financials;
                        delete this.data.application.metrics;
                        
                        console.log("Form: Loaded draft and normalized structure", full.id);
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
            type: acc.code.startsWith('6') || acc.group.startsWith('G') ? 'expense' : 'revenue',
            group: acc.group,
            bp_year: 0, cr_n1: 0, cr_n2: 0, cr_n3: 0,
            isOther: acc.isOther || false,
            isReadOnly: acc.isReadOnly || false
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
                            <input type="radio" name="axe" value="${axe.code}" 
                                ${this.data.application.selected_axe === axe.code ? 'checked' : ''} 
                                onchange="FORM.data.application.selected_axe = this.value">
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
        const title = type === 'expense' ? 'Dépenses (Charges)' : 'Recettes (Produits)';
        const allRows = this.data.financials.filter(f => f.type === type);
        
        // Group rows by their group ID
        const groups = [...new Set(allRows.map(r => r.group))];
        
        return `
            <div class="form-step wide">
                <h3>${title} - Budget prévisionnel par axe</h3>
                <p class="help-text">Détaillez ici les montants spécifiques au projet/axe sélectionné.</p>
                <div class="table-responsive">
                    <table class="financial-table">
                        <thead>
                            <tr>
                                <th>Compte</th>
                                <th>Libellé</th>
                                <th>BP 2026</th>
                                <th>CR 2025 (N-1)</th>
                                <th>CR 2024 (N-2)</th>
                                <th>CR 2023 (N-3)</th>
                                <th>Evol. %</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${groups.map(groupCode => {
                                const groupRows = allRows.filter(r => r.group === groupCode);
                                return `
                                    ${groupRows.map(row => `
                                        <tr class="${row.isReadOnly ? 'readonly-row' : ''} ${row.isOther ? 'other-row' : ''}">
                                            <td>${row.account_code}</td>
                                            <td>
                                                ${row.isOther 
                                                    ? `<input type="text" class="calc-label" data-code="${row.account_code}" value="${row.label}" placeholder="Précisez ici...">`
                                                    : row.label
                                                }
                                            </td>
                                            <td><input type="number" class="calc-input" data-code="${row.account_code}" data-field="bp_year" value="${row.bp_year || 0}" ${row.isReadOnly ? 'readonly' : ''}></td>
                                            <td><input type="number" class="calc-input" data-code="${row.account_code}" data-field="cr_n1" value="${row.cr_n1 || 0}"></td>
                                            <td><input type="number" class="calc-input" data-code="${row.account_code}" data-field="cr_n2" value="${row.cr_n2 || 0}"></td>
                                            <td><input type="number" class="calc-input" data-code="${row.account_code}" data-field="cr_n3" value="${row.cr_n3 || 0}"></td>
                                            <td class="readonly-cell row-evol" data-code="${row.account_code}">${(window.UTILS && window.UTILS.calculateEvolution) ? UTILS.calculateEvolution(row.bp_year, row.cr_n1) : 0}%</td>
                                        </tr>
                                    `).join('')}
                                    <tr class="subtotal-row">
                                        <td colspan="2">Sous-total ${groupCode}</td>
                                        <td class="st-bp" data-group="${groupCode}">0</td>
                                        <td class="st-n1" data-group="${groupCode}">0</td>
                                        <td class="st-n2" data-group="${groupCode}">0</td>
                                        <td class="st-n3" data-group="${groupCode}">0</td>
                                        <td class="st-evol" data-group="${groupCode}">0%</td>
                                    </tr>
                                `;
                            }).join('')}
                            <tr class="total-row">
                                <td colspan="2">TOTAL GÉNÉRAL ${title}</td>
                                <td id="total-bp">0</td>
                                <td id="total-n1">0</td>
                                <td id="total-n2">0</td>
                                <td id="total-n3">0</td>
                                <td id="total-evol">0%</td>
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
                <h3>Bilan Simplifié de l'association</h3>
                <p class="help-text">Informations générales sur la santé financière de la structure.</p>
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>Indicateur</th>
                                <th>2026 (Est.)</th>
                                <th>2025 (N-1)</th>
                                <th>2024 (N-2)</th>
                                <th>2023 (N-3)</th>
                                <th>Evol. %</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Trésorerie disponible (Actif)</td>
                                <td><input type="number" class="calc-input" data-code="TRESO" data-field="bp_year" value="${this.getFinVal('TRESO', 'bp_year')}"></td>
                                <td><input type="number" class="calc-input" data-code="TRESO" data-field="cr_n1" value="${this.getFinVal('TRESO', 'cr_n1')}"></td>
                                <td><input type="number" class="calc-input" data-code="TRESO" data-field="cr_n2" value="${this.getFinVal('TRESO', 'cr_n2')}"></td>
                                <td><input type="number" class="calc-input" data-code="TRESO" data-field="cr_n3" value="${this.getFinVal('TRESO', 'cr_n3')}"></td>
                                <td class="readonly-cell row-evol" data-code="TRESO">${(window.UTILS && window.UTILS.calculateEvolution) ? UTILS.calculateEvolution(this.getFinVal('TRESO', 'bp_year'), this.getFinVal('TRESO', 'cr_n1')) : 0}%</td>
                            </tr>
                            <tr>
                                <td>Dettes (Passif)</td>
                                <td><input type="number" class="calc-input" data-code="DETTES" data-field="bp_year" value="${this.getFinVal('DETTES', 'bp_year')}"></td>
                                <td><input type="number" class="calc-input" data-code="DETTES" data-field="cr_n1" value="${this.getFinVal('DETTES', 'cr_n1')}"></td>
                                <td><input type="number" class="calc-input" data-code="DETTES" data-field="cr_n2" value="${this.getFinVal('DETTES', 'cr_n2')}"></td>
                                <td><input type="number" class="calc-input" data-code="DETTES" data-field="cr_n3" value="${this.getFinVal('DETTES', 'cr_n3')}"></td>
                                <td class="readonly-cell row-evol" data-code="DETTES">${(window.UTILS && window.UTILS.calculateEvolution) ? UTILS.calculateEvolution(this.getFinVal('DETTES', 'bp_year'), this.getFinVal('DETTES', 'cr_n1')) : 0}%</td>
                            </tr>
                            <tr>
                                <td>Résultat de l'exercice</td>
                                <td><input type="number" class="calc-input" data-code="RESULTAT" data-field="bp_year" value="${this.getFinVal('RESULTAT', 'bp_year')}"></td>
                                <td><input type="number" class="calc-input" data-code="RESULTAT" data-field="cr_n1" value="${this.getFinVal('RESULTAT', 'cr_n1')}"></td>
                                <td><input type="number" class="calc-input" data-code="RESULTAT" data-field="cr_n2" value="${this.getFinVal('RESULTAT', 'cr_n2')}"></td>
                                <td><input type="number" class="calc-input" data-code="RESULTAT" data-field="cr_n3" value="${this.getFinVal('RESULTAT', 'cr_n3')}"></td>
                                <td class="readonly-cell row-evol" data-code="RESULTAT">${(window.UTILS && window.UTILS.calculateEvolution) ? UTILS.calculateEvolution(this.getFinVal('RESULTAT', 'bp_year'), this.getFinVal('RESULTAT', 'cr_n1')) : 0}%</td>
                            </tr>
                            <tr>
                                <td>Report à nouveau / Réserves</td>
                                <td><input type="number" class="calc-input" data-code="RESERVES" data-field="bp_year" value="${this.getFinVal('RESERVES', 'bp_year')}"></td>
                                <td><input type="number" class="calc-input" data-code="RESERVES" data-field="cr_n1" value="${this.getFinVal('RESERVES', 'cr_n1')}"></td>
                                <td><input type="number" class="calc-input" data-code="RESERVES" data-field="cr_n2" value="${this.getFinVal('RESERVES', 'cr_n2')}"></td>
                                <td><input type="number" class="calc-input" data-code="RESERVES" data-field="cr_n3" value="${this.getFinVal('RESERVES', 'cr_n3')}"></td>
                                <td class="readonly-cell row-evol" data-code="RESERVES">${(window.UTILS && window.UTILS.calculateEvolution) ? UTILS.calculateEvolution(this.getFinVal('RESERVES', 'bp_year'), this.getFinVal('RESERVES', 'cr_n1')) : 0}%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="form-actions">
                    <button class="btn" onclick="FORM.renderStep(7)">Précédent</button>
                    <button class="btn btn-primary" onclick="FORM.saveAndNext(9)">Suivant</button>
                </div>
            </div>
        `;
    },

    getFinVal(code, field) {
        if (!this.data.financials) return 0;
        const row = this.data.financials.find(f => f.account_code === code);
        return row ? (row[field] || 0) : 0;
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

        // Sync labels for "Other" rows
        document.querySelectorAll('.calc-label').forEach(input => {
            input.addEventListener('input', (e) => {
                const code = e.target.dataset.code;
                const rec = this.data.financials.find(f => f.account_code === code);
                if (rec) rec.label = e.target.value;
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
        const allRows = this.data.financials.filter(f => f.type === type);
        
        // 1. Update Group Sub-totals
        const groups = [...new Set(allRows.map(r => r.group))];
        groups.forEach(g => {
            const gRows = allRows.filter(r => r.group === g);
            const bp = gRows.reduce((s, r) => s + (parseFloat(r.bp_year) || 0), 0);
            const n1 = gRows.reduce((s, r) => s + (parseFloat(r.cr_n1) || 0), 0);
            const n2 = gRows.reduce((s, r) => s + (parseFloat(r.cr_n2) || 0), 0);
            const n3 = gRows.reduce((s, r) => s + (parseFloat(r.cr_n3) || 0), 0);
            
            document.querySelectorAll(`.st-bp[data-group="${g}"]`).forEach(el => el.textContent = bp.toLocaleString());
            document.querySelectorAll(`.st-n1[data-group="${g}"]`).forEach(el => el.textContent = n1.toLocaleString());
            document.querySelectorAll(`.st-n2[data-group="${g}"]`).forEach(el => el.textContent = n2.toLocaleString());
            document.querySelectorAll(`.st-n3[data-group="${g}"]`).forEach(el => el.textContent = n3.toLocaleString());
            
            const evol = (window.UTILS && window.UTILS.calculateEvolution) ? UTILS.calculateEvolution(bp, n1) : 0;
            document.querySelectorAll(`.st-evol[data-group="${g}"]`).forEach(el => el.textContent = evol + '%');
        });

        // 1.5 Update Row Evolutions
        allRows.forEach(row => {
            const evol = (window.UTILS && window.UTILS.calculateEvolution) ? UTILS.calculateEvolution(row.bp_year, row.cr_n1) : 0;
            document.querySelectorAll(`.row-evol[data-code="${row.account_code}"]`).forEach(el => el.textContent = evol + '%');
        });

        // 2. Update General Totals
        const bpTotal = allRows.reduce((sum, r) => sum + (parseFloat(r.bp_year) || 0), 0);
        const n1Total = allRows.reduce((sum, r) => sum + (parseFloat(r.cr_n1) || 0), 0);
        const n2Total = allRows.reduce((sum, r) => sum + (parseFloat(r.cr_n2) || 0), 0);
        const n3Total = allRows.reduce((sum, r) => sum + (parseFloat(r.cr_n3) || 0), 0);

        if (document.getElementById('total-bp')) document.getElementById('total-bp').textContent = bpTotal.toLocaleString() + ' €';
        if (document.getElementById('total-n1')) document.getElementById('total-n1').textContent = n1Total.toLocaleString() + ' €';
        if (document.getElementById('total-n2')) document.getElementById('total-n2').textContent = n2Total.toLocaleString() + ' €';
        if (document.getElementById('total-n3')) document.getElementById('total-n3').textContent = n3Total.toLocaleString() + ' €';
        
        const totalEvol = (window.UTILS && window.UTILS.calculateEvolution) ? UTILS.calculateEvolution(bpTotal, n1Total) : 0;
        if (document.getElementById('total-evol')) document.getElementById('total-evol').textContent = totalEvol + '%';
    },

    async saveAndNext(nextStep) {
        if (!STATE.association) return this.renderStep(nextStep);

        // Validation for Axe selection (Step 4)
        if (this.currentStep === 4 && !this.data.application.selected_axe) {
            return UI.notify("Veuillez sélectionner un axe avant de continuer.", "error");
        }

        UI.toggleLoader(true);
        try {
            // 1. Save or Update Application
            const appToSave = { ...this.data.application };
            delete appToSave.financials;
            delete appToSave.metrics;
            appToSave.association_id = STATE.association.id;
            
            let res;
            if (appToSave.id) {
                res = await sb.from('grant_applications').update(appToSave).eq('id', appToSave.id).select().single();
            } else {
                res = await sb.from('grant_applications').insert([appToSave]).select().single();
                this.data.application.id = res.data.id;
            }

            if (res.error) throw res.error;

            // 2. Save Financials (Batch & Sanitize)
            if (this.currentStep === 6 || this.currentStep === 7 || this.currentStep === 8) {
                const finData = this.data.financials.map(f => ({
                    application_id: this.data.application.id,
                    account_code: f.account_code,
                    type: f.type,
                    label: f.label,
                    group: f.group,
                    bp_year: parseFloat(f.bp_year) || 0,
                    cr_n1: parseFloat(f.cr_n1) || 0,
                    cr_n2: parseFloat(f.cr_n2) || 0,
                    cr_n3: parseFloat(f.cr_n3) || 0
                }));
                
                const { error: finErr } = await sb.from('financial_records').upsert(finData, { onConflict: 'application_id, account_code' });
                if (finErr) throw finErr;
            }

            UI.notify("Progrès enregistré.", "success");
            this.renderStep(nextStep);
        } catch (err) {
            console.error("Save error", err);
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
