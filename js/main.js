// Main Entry Point
document.addEventListener('DOMContentLoaded', async () => {
    // Check if Supabase loaded correctly
    if (typeof supabase === 'undefined') {
        console.error("Supabase CDN failed to load.");
        return;
    }

    // Initialize Modules
    console.log("DOM Ready. Initializing App...");
    
    // 1. UI First (prepare elements)
    UI.init();
    
    // 2. Auth Second (starts listener)
    try {
        console.log("Auth init...");
        await AUTH.init();
        
        // Safety check: If after 8 seconds the UI is still grey (nothing shown), force show login
        setTimeout(() => {
            const authVisible = !document.getElementById('auth-container').classList.contains('hidden');
            const appVisible = !document.getElementById('app-content').classList.contains('hidden');
            
            // If we have a user in STATE, we are likely loading profile, don't interrupt
            if (STATE.user && !appVisible) {
                console.log("AUTH: Profile loading is still in progress...");
                return;
            }

            if (!authVisible && !appVisible) {
                console.warn("Safety timeout triggered: Force showing login screen.");
                UI.showAuth();
            }
        }, 8000);

        console.log("CCMVR Application Ready.");
    } catch (err) {
        console.error("APP INITIALIZATION FAILED:", err);
        UI.showAuth();
    }
});

// Polyfill dynamic content for specific Excel data mapping
const EXCEL_MAPPING = {
    axes: [
        { code: '5a', principal: 'Enfance et Jeunesse', secondary: 'Accueil 0-6 ans : Crèches' },
        { code: '5b', principal: 'Enfance et Jeunesse', secondary: 'Accueil 3-14 ans : Périscolaire et Extrascolaire' },
        { code: '5c', principal: 'Enfance et Jeunesse', secondary: 'Accueil ados 11-17 ans' },
        { code: '5d', principal: 'Enfance et Jeunesse', secondary: 'Autres accueils : Ludothèque, Relais Petite Enfance, autres.' },
        { code: '6a', principal: 'Solidarités', secondary: 'Prévention et accès au droit (PAEJ, PIJ, CLAS, Habitat, accès aux droits, insertion.)' }
    ],
    financial_accounts: [
        // CHARGES (6x)
        { code: '60212', label: "Fournitures d'atelier ou d'activité" },
        { code: '60214', label: "Alimentation, boissons" },
        { code: '60635', label: "Petit équipement" },
        { code: '611',   label: "Prestation extérieure pour activité" },
        { code: '6135',  label: "Loyer et charges locatives" },
        { code: '6135b', label: "Location de matériel" },
        { code: '6156',  label: "Maintenance informatique" },
        { code: '621',   label: "Personnel extérieur à la structure" },
        { code: '622',   label: "Honoraires (hors activité)" },
        { code: '624',   label: "Transport de biens et personnes" },
        { code: '63',    label: "Impôts et taxes" },
        { code: '64',    label: "Charges de personnel" },
        { code: '65',    label: "Autres charges de gestion courante" },
        { code: '66',    label: "Charges financières" },
        { code: '67',    label: "Charges exceptionnelles" },
        { code: '68',    label: "Dot. aux amortis et provis." },
        
        // RECETTES (7x)
        { code: '70',    label: "Participation des familles" },
        { code: '70b',   label: "Prestation de service CAF" },
        { code: '70c',   label: "Bonus CTG CAF" },
        { code: '70d',   label: "Cotisations, Adhésions" },
        { code: '74',    label: "Subvention Marches du Velay Rochebaron" },
        { code: '74b',   label: "Subvention AJC (CCMVR)" },
        { code: '76',    label: "Produits financiers" },
        { code: '77',    label: "Produits exceptionnels" },
        { code: '78',    label: "Reprise sur Amortis. et provisions" },
        { code: '79',    label: "Transfert de charges" }
    ]
};
