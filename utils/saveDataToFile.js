const fs = require('fs')
const path = require('path')


exports.saveDataToFile = (folder, filename, data) => {
    const dirPath = path.join(__dirname, folder);
    const filePath = path.join(dirPath, filename);

    // Ensure the folder exists
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    // Write data to file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

    console.log(`Data saved to ${filePath}`);
};
