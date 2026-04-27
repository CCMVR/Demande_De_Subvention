/**
 * Shared utility functions for calculations, financial analysis, and formatting
 */
window.UTILS = {
    /**
     * Calculate evolution percentage between current and previous values
     */
    calculateEvolution(current, previous) {
        const cur = parseFloat(current) || 0;
        const prev = parseFloat(previous) || 0;
        if (prev === 0 && cur === 0) return "0.0";
        if (prev === 0) return "N/A";
        return (((cur - prev) / prev) * 100).toFixed(1);
    },

    /**
     * Format a number as currency (French locale)
     */
    formatCurrency(value) {
        const num = parseFloat(value) || 0;
        return num.toLocaleString('fr-FR') + ' €';
    },

    /**
     * Calculate Soldes Intermédiaires de Gestion (SIG)
     * Based on the financial_accounts structure
     */
    calculateSIG(financials, field = 'cr_n1') {
        const getVal = (code) => {
            const row = financials.find(f => f.account_code === code);
            return row ? (parseFloat(row[field]) || 0) : 0;
        };

        // Total charges par groupe
        const totalG1 = getVal('TOTAL_G1'); // Achats/services
        const totalG2 = getVal('TOTAL_G2'); // Impôts et taxes
        const totalG3 = getVal('TOTAL_G3'); // Charges de personnel
        const totalG4 = getVal('TOTAL_G4'); // Autres charges gestion courante
        const totalG5 = getVal('TOTAL_G5'); // Charges financières
        const totalG6 = getVal('TOTAL_G6'); // Charges exceptionnelles
        const totalG7 = getVal('TOTAL_G7'); // Dot. amortissements

        // Total recettes par groupe
        const totalR1 = getVal('TOTAL_R1'); // Produits des services
        const totalR2 = getVal('TOTAL_R2'); // Subventions d'exploitation
        const totalR3 = getVal('TOTAL_R3'); // Produits financiers
        const totalR4 = getVal('TOTAL_R4'); // Produits exceptionnels
        const totalR5 = getVal('TOTAL_R5'); // Reprises amortissements
        const totalR6 = getVal('TOTAL_R6'); // Transferts de charges
        const totalR7 = getVal('TOTAL_R7'); // Autres produits

        const totalCharges = totalG1 + totalG2 + totalG3 + totalG4 + totalG5 + totalG6 + totalG7;
        const totalProduits = totalR1 + totalR2 + totalR3 + totalR4 + totalR5 + totalR6 + totalR7;

        // Valeur Ajoutée = Produits services + Subventions - Achats/services ext.
        const valeurAjoutee = totalR1 + totalR2 + totalR7 - totalG1;

        // EBE = VA - Impôts - Charges de personnel
        const ebe = valeurAjoutee - totalG2 - totalG3;

        // Résultat d'exploitation = EBE - Autres charges gestion + Autres produits - Dot. amortissements + Reprises
        const resultatExploitation = ebe - totalG4 - totalG7 + totalR5 + totalR6;

        // Résultat courant = Rés. exploitation + Produits financiers - Charges financières
        const resultatCourant = resultatExploitation + totalR3 - totalG5;

        // Résultat net = Rés. courant + Produits except. - Charges except.
        const resultatNet = resultatCourant + totalR4 - totalG6;

        // CAF = Résultat Net + Dot. amortissements - Reprises amortissements
        const caf = resultatNet + totalG7 - totalR5;

        return {
            totalCharges,
            totalProduits,
            valeurAjoutee,
            ebe,
            resultatExploitation,
            resultatCourant,
            resultatNet,
            caf
        };
    },

    /**
     * Calculate Balance Sheet ratios from bilan data
     */
    calculateBilanRatios(bilanData, field = 'cr_n1') {
        const getVal = (code) => {
            if (!bilanData) return 0;
            // bilanData can be an object { B_ACTIF_IMMO: { cr_n1: X, ... }, ... }
            if (typeof bilanData === 'object' && !Array.isArray(bilanData)) {
                const row = bilanData[code];
                return row ? (parseFloat(row[field]) || 0) : 0;
            }
            // Or an array of financial records
            const row = bilanData.find(f => f.account_code === code);
            return row ? (parseFloat(row[field]) || 0) : 0;
        };

        const actifImmo = getVal('B_ACTIF_IMMO');
        const actifCirc = getVal('B_ACTIF_CIRC');
        const disponibilites = getVal('B_ACTIF_DISPO');
        const creances = getVal('B_ACTIF_CREANCES');
        const totalActif = getVal('B_ACTIF_TOTAL');

        const fondsPropres = getVal('B_PASSIF_FP');
        const fondsDedies = getVal('B_PASSIF_DEDIES');
        const provisions = getVal('B_PASSIF_PROV');
        const totalDettes = getVal('B_PASSIF_DETTES');
        const dettesCourtTerme = getVal('B_PASSIF_D0Y');
        const totalPassif = getVal('B_PASSIF_TOTAL');

        // Fonds de Roulement = Fonds propres + Dettes long terme + Fonds dédiés + Provisions - Actif immobilisé
        const dettesLongTerme = getVal('B_PASSIF_D1Y');
        const fondsRoulement = fondsPropres + fondsDedies + provisions + dettesLongTerme - actifImmo;

        // BFR = Créances + Stock - Dettes fournisseurs/court terme
        const stock = getVal('B_ACTIF_STOCK');
        const dettesFournisseurs = getVal('B_PASSIF_D_FOURN');
        const bfr = creances + stock - dettesCourtTerme;

        // Trésorerie nette = FR - BFR
        const tresorerieNette = fondsRoulement - bfr;

        return {
            actifImmo, actifCirc, disponibilites, creances, totalActif,
            fondsPropres, fondsDedies, provisions, totalDettes, totalPassif,
            fondsRoulement,
            bfr,
            tresorerieNette,
            dettesLongTerme, dettesCourtTerme
        };
    },

    /**
     * Calculate comprehensive ratios for admin analysis
     */
    calculateRatios(financials, bilanData, field = 'cr_n1') {
        const sig = UTILS.calculateSIG(financials, field);
        const bilan = UTILS.calculateBilanRatios(bilanData, field);

        const grantCCMVR = (() => {
            const row = financials.find(f => f.account_code === '74');
            return row ? (parseFloat(row[field]) || 0) : 0;
        })();

        // Trésorerie en jours de charges
        const chargesQuotidiennes = sig.totalCharges / 365;
        const treasuryDaysRaw = chargesQuotidiennes > 0 ? Math.round(bilan.disponibilites / chargesQuotidiennes) : 0;
        const treasuryDaysAdjusted = chargesQuotidiennes > 0 ? Math.round((bilan.disponibilites + bilan.creances - bilan.dettesCourtTerme) / chargesQuotidiennes) : 0;

        // Autonomie financière = Fonds propres / Total Passif
        const financialAutonomy = bilan.totalPassif > 0 ? (bilan.fondsPropres / bilan.totalPassif) : 0;

        // Dépendance CCMVR = Subvention CCMVR / Total Produits
        const ccmvrDependence = sig.totalProduits > 0 ? ((grantCCMVR / sig.totalProduits) * 100) : 0;

        // Taux de couverture des charges par produits propres
        const produitsPropres = sig.totalProduits - grantCCMVR;
        const coverageRate = sig.totalCharges > 0 ? ((produitsPropres / sig.totalCharges) * 100) : 0;

        // Part des charges de personnel
        const personalExpenseRate = sig.totalCharges > 0 ? (((() => {
            const row = financials.find(f => f.account_code === 'TOTAL_G3');
            return row ? (parseFloat(row[field]) || 0) : 0;
        })() / sig.totalCharges) * 100) : 0;

        // Taux de dépendance aux subventions (toutes subventions)
        const totalSubventions = (() => {
            const row = financials.find(f => f.account_code === 'TOTAL_R2');
            return row ? (parseFloat(row[field]) || 0) : 0;
        })();
        const subsidyDependence = sig.totalProduits > 0 ? ((totalSubventions / sig.totalProduits) * 100) : 0;

        // Ratio de solvabilité
        const solvabilityRatio = bilan.totalDettes > 0 ? (bilan.fondsPropres / bilan.totalDettes) : 999;

        return {
            sig,
            bilan,
            ratios: {
                treasuryDaysRaw,
                treasuryDaysAdjusted,
                financialAutonomy: (financialAutonomy * 100).toFixed(1),
                ccmvrDependence: ccmvrDependence.toFixed(1),
                coverageRate: coverageRate.toFixed(1),
                personalExpenseRate: personalExpenseRate.toFixed(1),
                subsidyDependence: subsidyDependence.toFixed(1),
                solvabilityRatio: solvabilityRatio.toFixed(2),
                fondsRoulement: bilan.fondsRoulement,
                bfr: bilan.bfr,
                tresorerieNette: bilan.tresorerieNette,
                caf: sig.caf
            }
        };
    },

    /**
     * Get risk level class and label for a given ratio
     */
    getRiskLevel(type, value) {
        const val = parseFloat(value) || 0;
        switch(type) {
            case 'treasuryDaysRaw':
            case 'treasuryDaysAdjusted':
                if (val > 60) return { cls: 'badge-success', label: 'Faible', score: 1 };
                if (val > 30) return { cls: 'badge-warning', label: 'Modéré', score: 2 };
                return { cls: 'badge-danger', label: 'Élevé', score: 3 };
            case 'financialAutonomy':
                if (val > 40) return { cls: 'badge-success', label: 'Solide', score: 1 };
                if (val > 20) return { cls: 'badge-warning', label: 'Fragile', score: 2 };
                return { cls: 'badge-danger', label: 'Critique', score: 3 };
            case 'ccmvrDependence':
            case 'subsidyDependence':
                if (val < 30) return { cls: 'badge-success', label: 'Faible', score: 1 };
                if (val < 60) return { cls: 'badge-warning', label: 'Modéré', score: 2 };
                return { cls: 'badge-danger', label: 'Élevé', score: 3 };
            case 'coverageRate':
                if (val > 70) return { cls: 'badge-success', label: 'Bon', score: 1 };
                if (val > 40) return { cls: 'badge-warning', label: 'Moyen', score: 2 };
                return { cls: 'badge-danger', label: 'Insuffisant', score: 3 };
            case 'personalExpenseRate':
                if (val < 60) return { cls: 'badge-success', label: 'Maîtrisé', score: 1 };
                if (val < 80) return { cls: 'badge-warning', label: 'Élevé', score: 2 };
                return { cls: 'badge-danger', label: 'Critique', score: 3 };
            case 'solvabilityRatio':
                if (val > 1) return { cls: 'badge-success', label: 'Solvable', score: 1 };
                if (val > 0.5) return { cls: 'badge-warning', label: 'Tendu', score: 2 };
                return { cls: 'badge-danger', label: 'Insolvable', score: 3 };
            case 'caf':
            case 'fondsRoulement':
            case 'tresorerieNette':
                if (val > 0) return { cls: 'badge-success', label: 'Positif', score: 1 };
                if (val === 0) return { cls: 'badge-warning', label: 'Nul', score: 2 };
                return { cls: 'badge-danger', label: 'Négatif', score: 3 };
            default:
                return { cls: 'badge-secondary', label: '', score: 0 };
        }
    },

    /**
     * Calculate global risk score (0-100, higher = more risk)
     */
    calculateGlobalRiskScore(ratios) {
        const indicators = [
            { type: 'treasuryDaysRaw', value: ratios.treasuryDaysRaw, weight: 2 },
            { type: 'financialAutonomy', value: ratios.financialAutonomy, weight: 2 },
            { type: 'ccmvrDependence', value: ratios.ccmvrDependence, weight: 1.5 },
            { type: 'coverageRate', value: ratios.coverageRate, weight: 1.5 },
            { type: 'personalExpenseRate', value: ratios.personalExpenseRate, weight: 1 },
            { type: 'solvabilityRatio', value: ratios.solvabilityRatio, weight: 1 },
            { type: 'caf', value: ratios.caf, weight: 1.5 },
            { type: 'fondsRoulement', value: ratios.fondsRoulement, weight: 1 }
        ];

        let totalWeight = 0;
        let totalScore = 0;
        indicators.forEach(ind => {
            const risk = UTILS.getRiskLevel(ind.type, ind.value);
            totalScore += risk.score * ind.weight;
            totalWeight += ind.weight;
        });

        // Normalize to 0-100 (score 1=low risk, 3=high risk → 0-100)
        const normalized = totalWeight > 0 ? ((totalScore / totalWeight - 1) / 2) * 100 : 50;
        return Math.round(Math.min(100, Math.max(0, normalized)));
    },

    /**
     * Get global risk label and color
     */
    getGlobalRiskLabel(score) {
        if (score <= 25) return { label: 'Risque faible', cls: 'badge-success', icon: '🟢' };
        if (score <= 50) return { label: 'Risque modéré', cls: 'badge-warning', icon: '🟡' };
        if (score <= 75) return { label: 'Risque élevé', cls: 'badge-danger', icon: '🟠' };
        return { label: 'Risque critique', cls: 'badge-danger', icon: '🔴' };
    }
};
