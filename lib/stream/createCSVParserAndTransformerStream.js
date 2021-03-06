const csv = require('fast-csv');
const QUOTE = /'/g;

const createCSVParserAndTransformerStream = (formatMap) => {
    let header = null;

    return csv({ delimiter: ';', includeEndRowDelimiter: true })
        .transform((data) => {
            try {
                if (header == null) header = data;
                else {
                    try {
                        const preparedData = {};
                        data.map((item, index) => {
                            if (formatMap[header[index]]) preparedData[header[index]] = formatMap[header[index]](item);
                            else preparedData[header[index]] = item ? item.replace(QUOTE, '') : null;
                        });

                        return preparedData;
                    } catch (ex) {
                        console.error(ex.stack);
                        throw ex;
                    }
                }
            } catch (ex) {
                console.error(ex.stack);
            }
        });
};

module.exports = createCSVParserAndTransformerStream;