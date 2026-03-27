import * as fs from 'fs';
import * as path from 'path';

const FILES_TO_MERGE = ['extracted_items.json', 'touchgal_collec2_extracted.json'];
const OUTPUT_FILE = 'all_items.json';

async function main() {
  try {
    const allItems: any[] = [];

    for (const filename of FILES_TO_MERGE) {
      const filePath = path.join(process.cwd(), filename);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (Array.isArray(data)) {
          allItems.push(...data);
          console.log(`Merged ${data.length} items from ${filename}`);
        }
      } else {
        console.warn(`File not found: ${filename}`);
      }
    }

    // Remove duplicates based on URL
    const uniqueItems = Array.from(new Map(allItems.map(item => [item.url, item])).values());
    console.log(`\nTotal unique items: ${uniqueItems.length} (out of ${allItems.length} total)`);

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(uniqueItems, null, 2));
    console.log(`Merged results saved to ${OUTPUT_FILE}`);

  } catch (error) {
    console.error('An error occurred during merge:', error);
  }
}

main();
