const fs = require('fs');
const pdfParse = require('pdf-parse');

const pdfPath = 'C:\\Users\\palak\\.gemini\\antigravity\\brain\\4ee6ce72-53e8-4aee-8933-40da423ee65c\\.user_uploaded\\media_1786869792116.pdf';

async function main() {
  if (!fs.existsSync(pdfPath)) {
    console.error('PDF file does not exist at:', pdfPath);
    return;
  }
  const buffer = fs.readFileSync(pdfPath);
  console.log('PDF file read successfully. Size:', buffer.length, 'bytes');

  try {
    const data = await pdfParse(buffer);
    const rawText = data.text || '';
    console.log('\n--- RAW TEXT ---');
    console.log(rawText);
  } catch (err) {
    console.error('Extraction failed:', err);
  }
}

main();
