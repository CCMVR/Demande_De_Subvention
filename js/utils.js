/**
 * Financial Calculation Utilities and Ratios
 */
const UTILS = {
    /**
     * @param {Object} financials - Array of financial records
     * @returns {Object} Calculated totals and ratios
     */
    calculateRatios(financials, assets, liabilities) {
        const bpExpenses = financials.filter(f => f.type === 'expense').reduce((sum, f) => sum + f.bp_year, 0);
        const crN1Expenses = financials.filter(f => f.type === 'expense').reduce((sum, f) => sum + f.cr_n1, 0);
        
        const bpRevenues = financials.filter(f => f.type === 'revenue').reduce((sum, f) => sum + f.bp_year, 0);
        const crN1Revenues = financials.filter(f => f.type === 'revenue').reduce((sum, f) => sum + f.cr_n1, 0);

        // Subvention CCMVR (specific account 74...)
        const ccmvrSub = financials.find(f => f.account_code === '74' && f.label.includes('CCMVR'))?.bp_year || 0;

        return {
            totals: {
                expenses: bpExpenses,
                revenues: bpRevenues,
                result: bpRevenues - bpExpenses
            },
            ratios: {
                // Trésorerie en nombre de jours de charges = (Disponibilités / Total Charges) * 365
                treasuryDays: crN1Expenses > 0 ? ((assets.disponibilites / crN1Expenses) * 365).toFixed(0) : 0,
                
                // Indépendance financière = Fonds associatifs / passif total
                financialAutonomy: liabilities.total > 0 ? (liabilities.fonds_propres / liabilities.total).toFixed(2) : 0,
                
                // Dépendance CCMVR = sub CCMVR / total produits
                ccmvrDependence: bpRevenues > 0 ? ((ccmvrSub / bpRevenues) * 100).toFixed(1) : 0
            }
        };
    },

    getRiskLevel(ratioKey, value) {
        // Simple logic derived from Sheet 10
        const thresholds = {
            treasuryDays: { min: 90, max: 365 },
            financialAutonomy: { min: 0.2, max: 1.0 },
            ccmvrDependence: { min: 10, max: 60 }
        };

        const t = thresholds[ratioKey];
        if (!t) return 'neutral';

        if (value < t.min) return 'danger';
        if (value > t.max) return 'warning';
        return 'safe';
    }
};
