const Db = require('./util/db');
const dataProcessor = require('./dataProcessor');
const formatters = require('./util/formatters');

const create_inf_diario_fi_urlList = () => {
    const template = (year, month) => `http://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS/inf_diario_fi_${padLeft(year, 4)}${padLeft(month, 2)}.csv`;
    const templateHist = (year) => `http://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS/HIST/inf_diario_fi_${padLeft(year, 4)}.zip`;

    const now = new Date();
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const years = [now.getFullYear() - 1, now.getFullYear()];

    const urlList = years.map(year => months.reduce((result, month) => {
        if (year == now.getFullYear() && month > now.getMonth() + 1) return result;

        result.push(template(year, month));
        return result;
    }, [])).reduce((acc, val) => acc.concat(val), []);

    const yearsHist = Array((now.getFullYear() - 2 - 2005)).fill(null).reduce(result => {
        result.push(result[result.length - 1] + 1);
        return result;
    }, [2005]);

    const urlListHist = yearsHist.map(year => templateHist(year));

    return urlList.concat(urlListHist);
};

const create_fbcdata_sgs = (indicator) => {
    const template = (indicator) => `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${indicator}/dados?formato=csv`;
    return template(indicator);
};

function padLeft(nr, n, str) {
    return Array(n - String(nr).length + 1).join(str || '0') + nr;
}

const create_inf_cadastral_fi_urlList = () => {
    const template = (year, month, day) => `http://dados.cvm.gov.br/dados/FI/CAD/DADOS/inf_cadastral_fi_${year}${padLeft(month, 2)}${padLeft(day, 2)}.csv`;

    const now = new Date();
    now.setDate(now.getDate() - 2);

    if (now.getDay() == 0 || now.getDay() == 6) {
        const t = new Date().getDate() + (6 - new Date().getDay() - 1) - 7;
        now.setDate(t);
    }

    return template(now.getFullYear(), now.getMonth() + 1, now.getDate());
};

const main = async () => {
    try {

        const db = new Db();

        await db.takeOnline();

        try {

            const inf_cadastral_fi_metadata = {
                table: 'inf_cadastral_fi',
                formatMap: {
                    'CNPJ_FUNDO': formatters.cleanCNPJ,
                    'DT_REG': formatters.parseDate,
                    'DT_CONST': formatters.parseDate,
                    'DT_CANCEL': formatters.parseDate,
                    'DT_INI_SIT': formatters.parseDate,
                    'DT_INI_ATIV': formatters.parseDate,
                    'DT_INI_EXERC': formatters.parseDate,
                    'DT_FIM_EXERC': formatters.parseDate,
                    'DT_INI_CLASSE': formatters.parseDate,
                    'DT_PATRIM_LIQ': formatters.parseDate,
                    'CNPJ_ADMIN': formatters.cleanCNPJ,
                    'CPF_CNPJ_GESTOR': formatters.cleanCNPJ,
                    'CNPJ_AUDITOR': formatters.cleanCNPJ,
                    'VL_PATRIM_LIQ': formatters.parseFloat,
                    'TAXA_PERFM': formatters.TAXA_PERFM
                }
            };

            const inf_diario_fi_metadata = {
                table: 'inf_diario_fi',
                upsertConflictField: ['CNPJ_FUNDO', 'DT_COMPTC'],
                formatMap: {
                    'CNPJ_FUNDO': formatters.cleanCNPJ,
                    'DT_COMPTC': formatters.parseDate,
                    'VL_TOTAL': formatters.parseFloat,
                    'VL_QUOTA': formatters.parseQuota,
                    'VL_PATRIM_LIQ': formatters.parseFloat,
                    'CAPTC_DIA': formatters.parseFloat,
                    'RESG_DIA': formatters.parseFloat,
                    'NR_COTST': formatters.parseInt,
                }
            };

            const fbcdata_sgs_12i_metadata = {
                table: 'fbcdata_sgs_12i',
                upsertConflictField: ['data'],
                formatMap: {
                    'data': formatters.parseBRDate,
                    'valor': formatters.parseBRFloat
                }
            };

            const inf_diario_fi_urlList = create_inf_diario_fi_urlList();
            const inf_cadastral_fi_urlList = create_inf_cadastral_fi_urlList();
            const fbcdata_sgs_12i = create_fbcdata_sgs(12);

            let dataList = [];

            dataList.push(...inf_diario_fi_urlList.map(url => { return { url, metadata: inf_diario_fi_metadata }; }));
            dataList.push({ url: inf_cadastral_fi_urlList, metadata: inf_cadastral_fi_metadata });
            dataList.push({ url: fbcdata_sgs_12i, metadata: fbcdata_sgs_12i_metadata });

            //dataList = dataList.slice(0, 5);

            //dataList.push({ url: 'http://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS/HIST/inf_diario_fi_2015.zip', metadata: inf_diario_fi_metadata })

            await dataProcessor(db, dataList);
        } catch (ex) {
            console.error(ex.stack);
            throw ex;
        } finally {
            await db.takeOffline();
        }
    } catch (ex) {
        console.error(ex.stack);
    }
};

module.exports = main;