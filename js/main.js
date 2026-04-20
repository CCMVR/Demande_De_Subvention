// Main Entry Point
document.addEventListener('DOMContentLoaded', () => {
    // Check if Supabase loaded correctly
    if (!supabase) {
        console.error("Supabase CDN failed to load.");
        return;
    }

    // Initialize Modules
    AUTH.init();
    UI.init();
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
        { code: '60212', label: "Fournitures d'atelier ou d'activité" },
        { code: '60214', label: "Alimentation, boissons" },
        { code: '60635', label: "Petit équipement" },
        { code: '611', label: "Prestation extérieure pour activité" },
        { code: '6135', label: "Loyer et charges locatives" },
        { code: '6156', label: "Maintenance informatique" },
        { code: '622', label: "Honoraires (hors activité)" }
        // ... more added during form implementation
    ]
};
