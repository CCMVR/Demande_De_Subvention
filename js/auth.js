const AUTH = {
    async init() {
        if (!sb) {
            console.error("AUTH: Supabase client (sb) is not initialized.");
            UI.notify("Erreur de connexion à la base de données.", "error");
            UI.showAuth();
            return;
        }

        // Listen for auth changes
        sb.auth.onAuthStateChange(async (event, session) => {
            console.log("Auth Event:", event);
            UI.toggleLoader(true);
            
            try {
                if (session) {
                    STATE.user = session.user;
                    await AUTH.loadProfile();
                    UI.showApp();
                } else {
                    STATE.user = null;
                    STATE.profile = null;
                    STATE.association = null;
                    UI.showAuth();
                }
            } catch (err) {
                console.error("Critical Auth Error:", err);
                UI.notify("Erreur d'initialisation du compte.", "error");
                UI.showAuth(); // Always fallback to something visible
            } finally {
                UI.toggleLoader(false);
            }
        });

        // Initialize UI listeners
        document.getElementById('login-form').addEventListener('submit', AUTH.login);
        document.getElementById('register-form').addEventListener('submit', AUTH.register);
        document.getElementById('logout-btn').addEventListener('click', () => sb.auth.signOut());
        
        document.getElementById('show-register').addEventListener('click', (e) => {
            e.preventDefault();
            UI.toggleAuthMode('register');
        });
        
        document.getElementById('show-login').addEventListener('click', (e) => {
            e.preventDefault();
            UI.toggleAuthMode('login');
        });
    },

    async login(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        UI.toggleLoader(true);
        try {
            const { error } = await sb.auth.signInWithPassword({ email, password });
            if (error) throw error;
        } catch (err) {
            UI.notify("Erreur de connexion : " + err.message, "error");
        } finally {
            UI.toggleLoader(false);
        }
    },

    async register(e) {
        e.preventDefault();
        
        // 1. Basic Auth Info
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const confirm = document.getElementById('reg-confirm-password').value;

        if (password !== confirm) {
            return UI.notify("Les mots de passe ne correspondent pas.", "error");
        }

        // 2. Association Data
        const assocData = {
            name: document.getElementById('reg-assoc-name').value,
            rna: document.getElementById('reg-rna').value,
            creation_date: document.getElementById('reg-creation-date').value,
            siren: document.getElementById('reg-siren').value,
            siret: document.getElementById('reg-siret').value,
            declarant_name: document.getElementById('reg-declarant').value,
            leaders_list: document.getElementById('reg-leaders').value,
            statutes_text: document.getElementById('reg-statutes').value,
            contact_email: document.getElementById('reg-contact-email').value,
            contact_phone: document.getElementById('reg-contact-phone').value
        };

        UI.toggleLoader(true);
        try {
            // A. Create Auth User
            const { data: authData, error: authError } = await sb.auth.signUp({ 
                email, 
                password,
                options: {
                    data: {
                        assoc_name: assocData.name
                    }
                }
            });
            
            if (authError) throw authError;
            if (!authData.user) throw new Error("Erreur lors de la création de l'utilisateur.");

            // B. Create Association Record
            const newAssoc = await DB.createAssociation(assocData);
            if (!newAssoc) throw new Error("Erreur lors de la création de la fiche association.");

            // C. Create Profile Record (Link Auth User to Association)
            await DB.createProfile({
                id: authData.user.id,
                association_id: newAssoc.id
            });

            UI.notify("Inscription réussie ! Vous pouvez maintenant vous connecter.", "success");
            UI.toggleAuthMode('login');
            document.getElementById('register-form').reset();
        } catch (err) {
            console.error("Registration Error:", err);
            UI.notify(err.message, "error");
        } finally {
            UI.toggleLoader(false);
        }
    },

    async loadProfile() {
        try {
            // Reset UI state before loading new profile
            UI.resetRoleUI();

            const profile = await DB.getProfile(STATE.user.id);
            STATE.profile = profile;
            
            if (profile && profile.association_id) {
                STATE.association = await DB.getAssociation(profile.association_id);
                document.getElementById('org-name').textContent = STATE.association.name;
                document.getElementById('user-role').textContent = "Association";
                await FORM.init();
                UI.switchView('dashboard');
            } else if (STATE.user.email && STATE.user.email.toLowerCase() === CONFIG.AO_EMAIL.toLowerCase()) {
                document.getElementById('org-name').textContent = "Administration CCMVR";
                document.getElementById('user-role').textContent = "Admin";
                document.getElementById('admin-menu').classList.remove('hidden');
                await ADMIN.init();
                UI.switchView('admin-dashboard');
            } else {
                // Default fallback for new users without associations yet
                document.getElementById('org-name').textContent = "Nouvel Utilisateur";
                document.getElementById('user-role').textContent = "En attente";
                UI.switchView('dashboard');
            }
        } catch (err) {
            console.error("Error loading profile", err);
        }
    }
};
