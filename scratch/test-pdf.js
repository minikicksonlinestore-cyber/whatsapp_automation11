import fs from 'fs';
import path from 'path';
import { extractTasksFromPdf } from '../lib/pdf/extractor.ts';

const pdfPath = 'C:\\Users\\palak\\.gemini\\antigravity\\brain\\4ee6ce72-53e8-4aee-8933-40da423ee65c\\.user_uploaded\\media_1786869792116.pdf';

async function main() {
  if (!fs.existsSync(pdfPath)) {
    console.error('PDF file does not exist at:', pdfPath);
    return;
  }
  const buffer = fs.readFileSync(pdfPath);
  console.log('PDF file read successfully. Size:', buffer.length, 'bytes');

  try {
    const result = await extractTasksFromPdf(buffer, {
      defaultYear: 2026,
    });
    console.log('Detected Month:', result.detectedMonth);
    console.log('Detected Year:', result.detectedYear);
    console.log('Extracted Tasks (Count:', result.tasks.length, '):');
    console.log(JSON.stringify(result.tasks, null, 2));
    
    // Also print raw text
    console.log('\n--- RAW TEXT ---');
    console.log(result.rawText.substring(0, 2000));
  } catch (err) {
    console.error('Extraction failed:', err);
  }
}

main();
