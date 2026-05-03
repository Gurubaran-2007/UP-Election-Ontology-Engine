const XLSX = require('xlsx');
const path = require('path');

const filePath = 'C:\\Users\\DELL\\Desktop\\election details 1\\Agra Cantt. (SC).xls';

try {
    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    console.log('Sheets in file:', sheetNames);

    const firstSheet = workbook.Sheets[sheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

    console.log('--- SAMPLE FROM CONSTITUENCY FILE ---');
    console.log(JSON.stringify(data.slice(0, 10), null, 2));
} catch (error) {
    console.error('Error reading file:', error.message);
}
