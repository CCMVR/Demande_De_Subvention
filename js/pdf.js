const PDF = {
    async generate(data) {
        const el = document.createElement('div');
        el.style.cssText = 'padding:30px;color:#1e293b;font-family:Arial,sans-serif;font-size:11px;';
        const Y = CONFIG.CURRENT_YEAR;
        const logoUrl = (typeof LOGO_BASE64 !== 'undefined' && LOGO_BASE64) ? LOGO_BASE64 : '';
        const assoc = data.association || data.associations || {};
        const bilanData = data.snapshot_bilan || assoc.bilan_data || {};
        const crData = data.snapshot_cr || assoc.global_budget_history || {};

        const header = `<div style="display:flex;justify-content:space-between;border-bottom:2px solid #721c24;padding-bottom:15px;margin-bottom:20px;align-items:center">
            ${logoUrl ? `<img src="${logoUrl}" style="width:70px;height:auto">` : '<div style="width:70px;height:70px;background:#721c24;border-radius:10px;color:white;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:9px">CCMVR</div>'}
            <div style="font-size:20px;font-weight:bold;color:#721c24;flex:1;text-align:center">Dossier de Subvention CCMVR</div>
            <div style="text-align:right;font-size:12px">Année : ${data.year||Y}</div>
        </div>`;

        const identity = `<section style="margin-bottom:20px"><h2 style="background:#f1f5f9;padding:8px;font-size:15px">1. IDENTITÉ</h2>
            <p><strong>Nom :</strong> ${assoc.name||'N/A'} | <strong>SIRET :</strong> ${assoc.siret||'N/A'}</p>
            <p><strong>Déclarant :</strong> ${data.declarant_name||'N/A'} | <strong>Axe :</strong> ${data.selected_axe||'N/A'}</p>
            <p style="font-size:14px;color:#721c24"><strong>Montant demandé : ${(data.total_requested||0).toLocaleString('fr-FR')} €</strong></p></section>`;

        const makeTable = (type) => {
            const title = type === 'expense' ? 'DÉPENSES (Charges)' : 'RECETTES (Produits)';
            const rows = (data.financials||[]).filter(f => f.type === type);
            if (!rows.length) return '';
            const groups = [...new Set(rows.map(r => r.group))];
            const config = EXCEL_MAPPING.financial_accounts;
            return `<h3 style="color:#721c24;border-bottom:1px solid #ddd;padding-bottom:3px;margin-top:15px;font-size:12px">${title}</h3>
                <table style="width:100%;border-collapse:collapse;font-size:9px">
                    <tr style="background:#f8fafc"><th style="padding:4px;text-align:left;border:1px solid #ddd">Libellé</th><th style="padding:4px;text-align:right;border:1px solid #ddd">BP ${Y}</th><th style="padding:4px;text-align:right;border:1px solid #ddd">CR ${Y-1}</th><th style="padding:4px;text-align:right;border:1px solid #ddd">CR ${Y-2}</th><th style="padding:4px;text-align:right;border:1px solid #ddd">CR ${Y-3}</th></tr>
                    ${groups.map(g => {
                        const gRows = rows.filter(r => r.group === g);
                        const cfgRow = config.find(c => c.group === g && c.isSubtotal);
                        const label = cfgRow ? cfgRow.subtotalLabel || cfgRow.label : g;
                        const detailRows = gRows.filter(r => !(r.account_code||'').startsWith('TOTAL_'));
                        const sub = (f) => detailRows.reduce((s,r) => s + (parseFloat(r[f])||0), 0);
                        return detailRows.map(r => `<tr><td style="padding:3px;border:1px solid #ddd">${r.label||config.find(c=>c.code===r.account_code)?.label||r.account_code}</td>
                            <td style="padding:3px;text-align:right;border:1px solid #ddd">${(r.bp_year||0).toLocaleString('fr-FR')} €</td>
                            <td style="padding:3px;text-align:right;border:1px solid #ddd">${(r.cr_n1||0).toLocaleString('fr-FR')} €</td>
                            <td style="padding:3px;text-align:right;border:1px solid #ddd">${(r.cr_n2||0).toLocaleString('fr-FR')} €</td>
                            <td style="padding:3px;text-align:right;border:1px solid #ddd">${(r.cr_n3||0).toLocaleString('fr-FR')} €</td></tr>`).join('') +
                        `<tr style="background:#f1f5f9;font-weight:bold"><td style="padding:3px;border:1px solid #ddd">${label}</td>
                            <td style="padding:3px;text-align:right;border:1px solid #ddd">${sub('bp_year').toLocaleString('fr-FR')} €</td>
                            <td style="padding:3px;text-align:right;border:1px solid #ddd">${sub('cr_n1').toLocaleString('fr-FR')} €</td>
                            <td style="padding:3px;text-align:right;border:1px solid #ddd">${sub('cr_n2').toLocaleString('fr-FR')} €</td>
                            <td style="padding:3px;text-align:right;border:1px solid #ddd">${sub('cr_n3').toLocaleString('fr-FR')} €</td></tr>`;
                    }).join('')}
                </table>`;
        };

        const makeBilan = () => {
            if (!bilanData || Object.keys(bilanData).length === 0) return '';
            const bilanAccounts = EXCEL_MAPPING.financial_accounts.filter(a => a.type === 'bilan');
            return `<h3 style="color:#475569;border-bottom:1px solid #ddd;padding-bottom:3px;margin-top:20px;font-size:12px">BILAN DE L'ASSOCIATION</h3>
                <table style="width:100%;border-collapse:collapse;font-size:9px">
                    <tr style="background:#475569;color:white"><th style="padding:4px;text-align:left;border:1px solid #ddd">Indicateur</th><th style="padding:4px;text-align:right;border:1px solid #ddd">N-1</th><th style="padding:4px;text-align:right;border:1px solid #ddd">N-2</th><th style="padding:4px;text-align:right;border:1px solid #ddd">N-3</th></tr>
                    ${bilanAccounts.map(acc => {
                        const v = bilanData[acc.code] || {};
                        const bold = acc.label.startsWith('TOTAL') || acc.code === 'B_DIFF';
                        return `<tr style="${bold?'background:#f1f5f9;font-weight:bold':''}"><td style="padding:3px;border:1px solid #ddd">${acc.label}</td>
                            <td style="padding:3px;text-align:right;border:1px solid #ddd">${(v.cr_n1||0).toLocaleString('fr-FR')} €</td>
                            <td style="padding:3px;text-align:right;border:1px solid #ddd">${(v.cr_n2||0).toLocaleString('fr-FR')} €</td>
                            <td style="padding:3px;text-align:right;border:1px solid #ddd">${(v.cr_n3||0).toLocaleString('fr-FR')} €</td></tr>`;
                    }).join('')}
                </table>`;
        };

        const declarations = `<section style="margin-bottom:20px"><h2 style="background:#f1f5f9;padding:8px;font-size:15px">3. DÉCLARATIONS SUR L'HONNEUR</h2>
            <p>Je soussigné <strong>${data.declarant_name||'...'}</strong> certifie exact l'ensemble des éléments.</p>
            <p>✔ L'association est à jour de ses obligations.</p><p>✔ Souscrit au contrat d'engagement républicain.</p>
            <div style="margin-top:30px;border-top:1px solid #ddd;padding-top:8px;font-style:italic;text-align:right;font-size:9px">
                Document généré le ${new Date().toLocaleString('fr-FR')}<br>ID : ${data.id||''}</div></section>`;

        el.innerHTML = header + identity + `<section style="margin-bottom:20px"><h2 style="background:#f1f5f9;padding:8px;font-size:15px">2. DONNÉES COMPTABLES</h2>${makeTable('expense')}${makeTable('revenue')}${makeBilan()}</section>` + declarations;

        return html2pdf().set({
            margin: [10,10,10,10],
            filename: `Dossier_Subvention_${assoc.name||'Asso'}_${Y}.pdf`,
            image: { type:'jpeg', quality:0.98 },
            html2canvas: { scale:2 },
            jsPDF: { unit:'mm', format:'a4', orientation:'portrait' }
        }).from(el).save();
    }
};
