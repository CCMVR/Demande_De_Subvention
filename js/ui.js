const UI = {
    init() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.getAttribute('data-view');
                UI.switchView(view);
            });
        });
        UI.applyLogo();
        UI.fetchGitHubVersion();
    },

    applyLogo() {
        if (typeof LOGO_BASE64 !== 'undefined' && LOGO_BASE64 !== "") {
            let logoUrl = LOGO_BASE64;
            if (!logoUrl.startsWith('data:')) logoUrl = 'data:image/png;base64,' + logoUrl;
            document.querySelectorAll('.logo-container').forEach(container => {
                container.style.backgroundImage = `url('${logoUrl}')`;
                container.style.backgroundColor = 'transparent';
                container.style.boxShadow = 'none';
                container.textContent = '';
            });
        }
    },

    async fetchGitHubVersion() {
        const versionEl = document.getElementById('github-version');
        if (!versionEl) return;
        try {
            let repo = CONFIG.GITHUB_REPO;
            if (window.location.hostname.includes('github.io')) {
                const parts = window.location.hostname.split('.');
                const owner = parts[0];
                const repoName = window.location.pathname.split('/')[1] || repo.split('/')[1];
                repo = `${owner}/${repoName}`;
            }
            const response = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=1`);
            if (!response.ok) throw new Error('GitHub API error');
            const data = await response.json();
            if (data && data.length > 0) {
                const date = new Date(data[0].commit.committer.date);
                versionEl.textContent = `v. ${date.toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}`;
            }
        } catch (e) {
            versionEl.textContent = "Mode Local";
        }
    },

    notify(message, type = 'info') {
        const container = document.getElementById('notification-container');
        const notif = document.createElement('div');
        notif.className = `notification ${type}`;
        notif.innerHTML = `<div class="notif-content">${message}</div><button class="notif-close">&times;</button>`;
        container.appendChild(notif);
        setTimeout(() => { notif.classList.add('fade-out'); setTimeout(() => notif.remove(), 500); }, 5000);
        notif.querySelector('.notif-close').addEventListener('click', () => notif.remove());
    },

    toggleLoader(show) {
        document.getElementById('global-loader').classList.toggle('hidden', !show);
    },

    showAuth() {
        document.getElementById('splash-screen')?.classList.add('hidden');
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-content').classList.add('hidden');
    },

    showApp() {
        document.getElementById('splash-screen')?.classList.add('hidden');
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-content').classList.remove('hidden');
    },

    resetRoleUI() {
        document.getElementById('admin-menu').classList.add('hidden');
        document.getElementById('user-role').textContent = "Association";
        document.getElementById('org-name').textContent = "Chargement...";
    },

    toggleAuthMode(mode) {
        const login = document.getElementById('login-form');
        const register = document.getElementById('register-form');
        if (mode === 'login') { login.classList.remove('hidden'); register.classList.add('hidden'); }
        else { login.classList.add('hidden'); register.classList.remove('hidden'); }
    },

    // FIXED: accepts extraData parameter (fixes UUID bug for admin dossier view)
    async switchView(viewId, extraData) {
        STATE.currentView = viewId;
        if (extraData !== undefined) STATE.viewData = extraData;

        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-view') === viewId);
        });

        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';

        try {
            let html = '';
            switch (viewId) {
                case 'dashboard': html = await UI.renderDashboard(); break;
                case 'application': html = await UI.renderApplicationForm(); break;
                case 'history': html = await UI.renderHistory(); break;
                case 'profile': html = await UI.renderProfile(); break;
                case 'admin-dashboard': html = await ADMIN.renderAdminDashboard(); break;
                case 'admin-view-dossier': html = await ADMIN.renderDossierDetail(extraData || STATE.viewData); break;
                case 'admin-instruction': html = await ADMIN.renderInstructionTable(); break;
                default: html = '<h3>Vue en cours de développement</h3>';
            }
            contentArea.innerHTML = html;
            UI.initViewInteractions(viewId);
        } catch (err) {
            console.error("View render error:", err);
            contentArea.innerHTML = `<div class="error-state card"><h3>Erreur</h3><p>${err.message}</p></div>`;
        }
    },

    async renderDashboard() {
        const applications = STATE.association ? await DB.getApplicationsByAssoc(STATE.association.id) : [];
        const lastApp = applications.find(a => a.year === CONFIG.CURRENT_YEAR) || null;
        STATE.lastApplication = lastApp;

        // Check for messages on current application
        let messagesHtml = '';
        if (lastApp && lastApp.id) {
            try {
                const messages = await DB.getMessages(lastApp.id);
                if (messages && messages.length > 0) {
                    const adminMessages = messages.filter(m => m.sender_role === 'admin');
                    if (adminMessages.length > 0) {
                        messagesHtml = `
                            <section class="card messages-card">
                                <h3><i class="fas fa-envelope"></i> Messages de l'administration</h3>
                                <div class="messages-list">
                                    ${adminMessages.map(m => `
                                        <div class="message-item admin-message">
                                            <div class="message-meta"><i class="fas fa-user-shield"></i> Admin — ${new Date(m.created_at).toLocaleString('fr-FR')}</div>
                                            <div class="message-content">${m.content}</div>
                                        </div>
                                    `).join('')}
                                </div>
                                <div class="reply-box" style="margin-top:15px">
                                    <textarea id="reply-message" rows="2" placeholder="Répondre à l'administration..." style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-family:inherit;"></textarea>
                                    <button class="btn btn-primary" style="margin-top:8px;width:auto" onclick="UI.sendReply()"><i class="fas fa-paper-plane"></i> Envoyer</button>
                                </div>
                            </section>
                        `;
                    }
                }
            } catch(e) { console.warn("Messages load failed:", e); }
        }

        const statusLabels = { draft: 'Brouillon', submitted: 'Soumise', validated: 'Validée', refused: 'Refusée', frozen: 'Figée (RGPD)' };

        return `
            <div class="dashboard-grid">
                <section class="card welcome-card">
                    <h3>Bienvenue, ${STATE.association ? STATE.association.name : 'Utilisateur'}</h3>
                    <p>Gérez vos demandes de subvention annuelle pour la CCMVR.</p>
                </section>
                
                ${messagesHtml}

                <section class="card status-card">
                    <h3>État de votre demande ${CONFIG.CURRENT_YEAR}</h3>
                    ${lastApp ? `
                        <div class="status-indicator status-${lastApp.status}">
                            <i class="fas fa-circle"></i> Statut : ${statusLabels[lastApp.status] || lastApp.status}
                        </div>
                        <p>Dernière mise à jour : ${new Date(lastApp.updated_at || lastApp.created_at).toLocaleDateString('fr-FR')}</p>
                        <div class="card-actions" style="margin-top:15px; display:flex; gap:10px; flex-wrap:wrap;">
                            ${lastApp.status === 'draft' ? `
                                <button class="btn btn-primary" style="width:auto" onclick="UI.switchView('application')"><i class="fas fa-edit"></i> Continuer ma demande</button>
                                <button class="btn btn-danger-outline" onclick="FORM.deleteApplication('${lastApp.id}')"><i class="fas fa-trash-alt"></i> Supprimer</button>
                            ` : ''}
                            ${lastApp.status === 'submitted' ? `
                                <button class="btn btn-primary" style="width:auto" onclick="UI.switchView('application')"><i class="fas fa-edit"></i> Modifier ma demande</button>
                            ` : ''}
                            ${lastApp.status === 'validated' || lastApp.status === 'refused' ? `
                                <div class="info-box" style="margin:0">
                                    ${lastApp.status === 'validated' && lastApp.final_voted ? `<p><strong>Subvention votée :</strong> ${parseFloat(lastApp.final_voted).toLocaleString('fr-FR')} €</p>` : ''}
                                    <p><em>Ce dossier est figé et ne peut plus être modifié.</em></p>
                                </div>
                            ` : ''}
                            <button class="btn btn-secondary" id="download-pdf"><i class="fas fa-file-pdf"></i> Télécharger (PDF)</button>
                        </div>
                    ` : `
                        <p>Aucune demande en cours pour l'année ${CONFIG.CURRENT_YEAR}.</p>
                        <button class="btn btn-primary" style="width:auto" onclick="UI.switchView('application')">Démarrer une demande</button>
                    `}
                </section>

                <section class="card history-card">
                    <h3>Dernières activités</h3>
                    <ul class="activity-list">
                        ${applications.slice(0, 5).map(app => `
                            <li>Demande ${app.year} — ${statusLabels[app.status] || app.status}${app.final_voted ? ` (${parseFloat(app.final_voted).toLocaleString('fr-FR')} €)` : ''}</li>
                        `).join('') || '<li>Aucune activité récente</li>'}
                    </ul>
                </section>
            </div>
        `;
    },

    async sendReply() {
        const textarea = document.getElementById('reply-message');
        if (!textarea || !textarea.value.trim()) return UI.notify("Veuillez écrire un message.", "error");
        if (!STATE.lastApplication) return;
        UI.toggleLoader(true);
        try {
            await DB.sendMessage(STATE.lastApplication.id, 'association', textarea.value.trim());
            UI.notify("Message envoyé.", "success");
            UI.switchView('dashboard');
        } catch(e) { UI.notify(e.message, "error"); }
        finally { UI.toggleLoader(false); }
    },

    async renderProfile() {
        if (!STATE.association) return `<div class="card"><h3>Profil non trouvé</h3><p>Impossible de charger les informations de votre association.</p></div>`;

        const a = STATE.association;
        const bilanData = a.bilan_data || {};
        const bilanRows = EXCEL_MAPPING.financial_accounts.filter(acc => acc.type === 'bilan');
        const bilanUpdated = a.bilan_updated_at ? new Date(a.bilan_updated_at).toLocaleDateString('fr-FR') : 'Jamais';

        return `
            <div class="card">
                <h3>Mon Profil Association</h3>
                <p class="help-text">Modifiez ici les informations de base utilisées pour vos futures demandes.</p>
                <form id="profile-edit-form" style="margin-top: 20px">
                    <div class="form-section">
                        <h4>Informations Administratives</h4>
                        <div class="input-group"><label>Nom de l'association</label><input type="text" id="p-name" value="${a.name || ''}" required></div>
                        <div class="grid-2">
                            <div class="input-group"><label>Numéro RNA</label><input type="text" id="p-rna" value="${a.rna || ''}" required></div>
                            <div class="input-group"><label>Date de création</label><input type="date" id="p-creation-date" value="${a.creation_date || ''}" required></div>
                        </div>
                        <div class="grid-2">
                            <div class="input-group"><label>Numéro SIREN</label><input type="text" id="p-siren" value="${a.siren || ''}" required></div>
                            <div class="input-group"><label>Numéro SIRET</label><input type="text" id="p-siret" value="${a.siret || ''}" required></div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h4>Gouvernance &amp; Statuts</h4>
                        <div class="input-group"><label>Nom complet du déclarant</label><input type="text" id="p-declarant" value="${a.declarant_name || ''}" required></div>
                        <div class="input-group"><label>Liste des dirigeants (Bureau)</label><textarea id="p-leaders" rows="3" required>${a.leaders_list || ''}</textarea></div>
                        <div class="input-group"><label>Texte des statuts</label><textarea id="p-statutes" rows="5" required>${a.statutes_text || ''}</textarea></div>
                    </div>

                    <div class="form-section">
                        <h4>Coordonnées de contact</h4>
                        <div class="grid-2">
                            <div class="input-group"><label>Email de contact public</label><input type="email" id="p-contact-email" value="${a.contact_email || ''}" required></div>
                            <div class="input-group"><label>Numéro de contact</label><input type="tel" id="p-contact-phone" value="${a.contact_phone || ''}" required></div>
                        </div>
                    </div>

                    <div class="form-section highlight">
                        <h4>Finances Globales de l'Association</h4>
                        <div class="grid-2">
                            <div class="input-group"><label>Budget total de fonctionnement (€)</label><input type="number" id="p-total-budget" value="${a.total_budget || 0}"></div>
                            <div class="input-group"><label>Nombre de salariés (ETP)</label><input type="number" id="p-employees" value="${a.employees_count || 0}"></div>
                        </div>
                    </div>

                    <div class="profile-section">
                        <h4>Budget Global de l'Association (Historique &amp; Prévisionnel)</h4>
                        <p class="help-text">Totaux par catégorie pour l'ensemble de votre structure.</p>
                        <div class="table-responsive">
                            <table class="financial-table">
                                <thead><tr>
                                    <th>Catégorie</th><th>BP ${CONFIG.CURRENT_YEAR}</th><th>CR ${CONFIG.CURRENT_YEAR-1} (N-1)</th><th>CR ${CONFIG.CURRENT_YEAR-2} (N-2)</th><th>CR ${CONFIG.CURRENT_YEAR-3} (N-3)</th>
                                </tr></thead>
                                <tbody>
                                    ${['G1','G2','G3','G4','G5','G6','G7','R1','R2','R3','R4','R5','R6','R7'].map(g => {
                                        const configRow = EXCEL_MAPPING.financial_accounts.find(acc => acc.group === g && acc.isSubtotal);
                                        const label = configRow ? configRow.label : g;
                                        const type = g.startsWith('G') ? 'expense' : 'revenue';
                                        const history = a.global_budget_history || {};
                                        const row = history[g] || { bp: 0, n1: 0, n2: 0, n3: 0 };
                                        return `<tr class="${type}-row">
                                            <td style="font-size:0.8rem"><strong>${label}</strong></td>
                                            <td><input type="number" class="p-budget-input" data-group="${g}" data-field="bp" value="${row.bp}"></td>
                                            <td><input type="number" class="p-budget-input" data-group="${g}" data-field="n1" value="${row.n1}"></td>
                                            <td><input type="number" class="p-budget-input" data-group="${g}" data-field="n2" value="${row.n2}"></td>
                                            <td><input type="number" class="p-budget-input" data-group="${g}" data-field="n3" value="${row.n3}"></td>
                                        </tr>`;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="profile-section" style="margin-top:30px">
                        <h4><i class="fas fa-balance-scale"></i> Bilan de l'Association (Actif / Passif)</h4>
                        <p class="help-text">Renseignez votre dernier bilan clos (N-1 = ${CONFIG.CURRENT_YEAR-1}). <strong>Obligatoire</strong> avant toute demande de subvention.</p>
                        <p class="help-text" style="font-size:0.8rem;color:#64748b">Dernière mise à jour : ${bilanUpdated}</p>
                        <div class="table-responsive">
                            <table class="bilan-table">
                                <thead><tr class="header-row">
                                    <th style="text-align:left">Indicateur</th><th>${CONFIG.CURRENT_YEAR-1} (N-1)</th><th>${CONFIG.CURRENT_YEAR-2} (N-2)</th><th>${CONFIG.CURRENT_YEAR-3} (N-3)</th>
                                </tr></thead>
                                <tbody>
                                    ${bilanRows.map(acc => {
                                        const vals = bilanData[acc.code] || { cr_n1: 0, cr_n2: 0, cr_n3: 0 };
                                        const isAuto = acc.isSubtotal;
                                        const rowClass = acc.label.startsWith('TOTAL') ? 'total-row' : (acc.code === 'B_DIFF' ? 'diff-row' : (acc.code.includes('ACTIF') ? 'actif-row' : 'passif-row'));
                                        return `<tr class="${rowClass}">
                                            <td style="text-align:left">${acc.label}</td>
                                            <td><input type="number" class="bilan-input ${isAuto ? 'auto-cell' : ''}" data-code="${acc.code}" data-field="cr_n1" value="${vals.cr_n1 || 0}" ${isAuto ? 'readonly' : ''}></td>
                                            <td><input type="number" class="bilan-input ${isAuto ? 'auto-cell' : ''}" data-code="${acc.code}" data-field="cr_n2" value="${vals.cr_n2 || 0}" ${isAuto ? 'readonly' : ''}></td>
                                            <td><input type="number" class="bilan-input ${isAuto ? 'auto-cell' : ''}" data-code="${acc.code}" data-field="cr_n3" value="${vals.cr_n3 || 0}" ${isAuto ? 'readonly' : ''}></td>
                                        </tr>`;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="form-actions"><button type="submit" class="btn btn-primary">Enregistrer les modifications</button></div>
                </form>
            </div>
        `;
    },

    recalcBilan() {
        ['cr_n1', 'cr_n2', 'cr_n3'].forEach(field => {
            const getVal = (code) => parseFloat(document.querySelector(`.bilan-input[data-code="${code}"][data-field="${field}"]`)?.value) || 0;
            const setVal = (code, val) => {
                const el = document.querySelector(`.bilan-input[data-code="${code}"][data-field="${field}"]`);
                if (el) el.value = Math.round(val * 100) / 100;
            };
            const actifCirc = getVal('B_ACTIF_CREANCES') + getVal('B_ACTIF_DISPO') + getVal('B_ACTIF_STOCK') + getVal('B_ACTIF_VMP') + getVal('B_ACTIF_CCA') + getVal('B_ACTIF_OTHER');
            setVal('B_ACTIF_CIRC', actifCirc);
            setVal('B_ACTIF_TOTAL', getVal('B_ACTIF_IMMO') + actifCirc);
            const fp = getVal('B_PASSIF_FONDS') + getVal('B_PASSIF_RESERVES') + getVal('B_PASSIF_RAN') + getVal('B_PASSIF_RESULTAT') + getVal('B_PASSIF_SUBV') + getVal('B_PASSIF_OTHER_FP');
            setVal('B_PASSIF_FP', fp);
            const dettes = getVal('B_PASSIF_D1Y') + getVal('B_PASSIF_D0Y') + getVal('B_PASSIF_D_FOURN') + getVal('B_PASSIF_PCA') + getVal('B_PASSIF_OTHER_D');
            setVal('B_PASSIF_DETTES', dettes);
            const totalPassif = fp + getVal('B_PASSIF_DEDIES') + getVal('B_PASSIF_PROV') + dettes;
            setVal('B_PASSIF_TOTAL', totalPassif);
            setVal('B_DIFF', getVal('B_ACTIF_TOTAL') - totalPassif);
        });
    },

    bindProfileEvents() {
        const form = document.getElementById('profile-edit-form');
        if (!form) return;

        // Bilan auto-calc
        document.querySelectorAll('.bilan-input:not(.auto-cell)').forEach(input => {
            input.addEventListener('input', () => UI.recalcBilan());
        });
        UI.recalcBilan();

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            UI.toggleLoader(true);

            const history = {};
            document.querySelectorAll('.p-budget-input').forEach(input => {
                const g = input.dataset.group, f = input.dataset.field;
                if (!history[g]) history[g] = { bp: 0, n1: 0, n2: 0, n3: 0 };
                history[g][f] = parseFloat(input.value) || 0;
            });

            const bilanData = {};
            document.querySelectorAll('.bilan-input').forEach(input => {
                const code = input.dataset.code, field = input.dataset.field;
                if (!bilanData[code]) bilanData[code] = { cr_n1: 0, cr_n2: 0, cr_n3: 0 };
                bilanData[code][field] = parseFloat(input.value) || 0;
            });

            const updatedData = {
                name: document.getElementById('p-name').value,
                rna: document.getElementById('p-rna').value,
                creation_date: document.getElementById('p-creation-date').value,
                siren: document.getElementById('p-siren').value,
                siret: document.getElementById('p-siret').value,
                declarant_name: document.getElementById('p-declarant').value,
                leaders_list: document.getElementById('p-leaders').value,
                statutes_text: document.getElementById('p-statutes').value,
                contact_email: document.getElementById('p-contact-email').value,
                contact_phone: document.getElementById('p-contact-phone').value,
                total_budget: parseFloat(document.getElementById('p-total-budget').value) || 0,
                employees_count: parseFloat(document.getElementById('p-employees').value) || 0,
                global_budget_history: history,
                bilan_data: bilanData,
                bilan_updated_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            try {
                const { error } = await sb.from('associations').update(updatedData).eq('id', STATE.association.id);
                if (error) throw error;
                STATE.association = { ...STATE.association, ...updatedData };
                document.getElementById('org-name').textContent = STATE.association.name;
                UI.notify("Profil mis à jour avec succès !", "success");
            } catch (err) {
                UI.notify("Erreur : " + err.message, "error");
            } finally { UI.toggleLoader(false); }
        });
    },

    async renderApplicationForm() {
        return `
            <div class="stepper-container">
                <div class="stepper-header">
                    ${[1,2,3,4,5,6,7,8].map(i => `<div class="step-badge">${i}</div>`).join('')}
                </div>
                <div id="step-content" class="card">
                    <div class="loader-container" style="padding:50px;text-align:center">
                        <div class="spinner"></div>
                        <p style="margin-top:15px;color:var(--primary-color);font-weight:500">Chargement de votre dossier...</p>
                    </div>
                </div>
            </div>
        `;
    },

    async renderHistory() {
        if (!STATE.association) return '<div class="card"><h3>Historique</h3><p>Aucun historique disponible.</p></div>';
        const apps = await DB.getApplicationsByAssoc(STATE.association.id);
        const statusLabels = { draft: 'Brouillon', submitted: 'Soumise', validated: 'Validée', refused: 'Refusée', frozen: 'Figée' };
        return `
            <div class="card">
                <h3>Historique des demandes</h3>
                ${apps.length > 0 ? `
                    <div class="table-responsive"><table class="financial-table">
                        <thead><tr><th>Année</th><th>Axe</th><th>Montant demandé</th><th>Statut</th><th>Subvention votée</th></tr></thead>
                        <tbody>${apps.map(app => `<tr>
                            <td>${app.year}</td><td>${app.selected_axe || '-'}</td>
                            <td>${(app.total_requested || 0).toLocaleString('fr-FR')} €</td>
                            <td><span class="badge">${statusLabels[app.status] || app.status}</span></td>
                            <td>${app.final_voted ? parseFloat(app.final_voted).toLocaleString('fr-FR') + ' €' : '-'}</td>
                        </tr>`).join('')}</tbody>
                    </table></div>
                ` : '<div class="info-box">Aucun historique disponible pour le moment.</div>'}
            </div>
        `;
    },

    initViewInteractions(viewId) {
        if (viewId === 'dashboard') {
            document.getElementById('download-pdf')?.addEventListener('click', async () => {
                if (STATE.lastApplication) {
                    UI.notify("Génération du PDF...", "info");
                    const fullData = await DB.getFullApplication(STATE.lastApplication.id);
                    fullData.association = STATE.association;
                    await PDF.generate(fullData);
                }
            });
        }
        if (viewId === 'application') {
            FORM.init().then(() => {
                const startStep = FORM.data.application.current_step || 1;
                FORM.renderStep(startStep);
            });
        }
        if (viewId === 'profile') { UI.bindProfileEvents(); }
        if (viewId === 'admin-instruction') { ADMIN.initInstructionEvents(); }
    }
};
