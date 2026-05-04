const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const file = 'C:\\Users\\DELL\\Desktop\\election details 1\\Agra South.xls';

if (fs.existsSync(file)) {
    const workbook = XLSX.readFile(file);
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {header: 1});
    console.log('--- FIRST 25 ROWS OF AGRA SOUTH ---');
    data.slice(0, 25).forEach((row, i) => {
        console.log(`Row ${i}:`, JSON.stringify(row));
    });
} else {
    console.log('File not found!');
}
