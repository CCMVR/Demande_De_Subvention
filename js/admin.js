/**
 * Administrator Dashboard Logic
 */
const ADMIN = {
    async init() {
        if (STATE.user.email !== CONFIG.AO_EMAIL) return;
        
        // Setup listeners for admin actions
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
            UI.switchView('admin-dashboard'); // Refresh
        } catch (err) {
            UI.notify(err.message, "error");
        } finally {
            UI.toggleLoader(false);
        }
    },

    async renderDashboard() {
        const preValed = await handleResponse(sb.from('prevalidated_emails').select('*').order('created_at', { ascending: false }));
        const associations = await handleResponse(sb.from('associations').select('*'));
        
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
                                        <td><button class="btn btn-icon"><i class="fas fa-eye"></i></button></td>
                                    </tr>
                                `).join('') || '<tr><td colspan="4">Aucun dossier soumis</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        `;
    }
};
