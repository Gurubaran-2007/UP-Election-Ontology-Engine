const XLSX = require('xlsx');
const path = require('path');

const filePath = 'C:\\Users\\DELL\\Desktop\\election details 1\\Detailed Results.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    console.log('Sheets in file:', sheetNames);

    // Read the first sheet
    const firstSheet = workbook.Sheets[sheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

    console.log('--- FIRST 5 ROWS ---');
    console.log(JSON.stringify(data.slice(0, 5), null, 2));
} catch (error) {
    console.error('Error reading file:', error.message);
}
