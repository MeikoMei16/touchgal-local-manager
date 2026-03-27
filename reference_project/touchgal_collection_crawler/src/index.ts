import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';

const DEFAULT_HTML_FILE = 'touchgal_collect.html';
const BASE_URL = 'https://www.touchgal.top';

async function main() {
  try {
    const filename = process.argv[2] || DEFAULT_HTML_FILE;
    const filePath = path.join(process.cwd(), filename);
    
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return;
    }

    const html = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(html);

    const items: { title: string; url: string }[] = [];

    // The target elements are <a> tags with specific classes
    $('a.text-lg.font-semibold').each((_, element) => {
      const $el = $(element);
      const title = $el.text().trim();
      const href = $el.attr('href');

      if (href && title) {
        // Construct absolute URL
        const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
        items.push({ title, url: fullUrl });
      }
    });

    console.log(`Processing file: ${filename}`);
    console.log(`Found ${items.length} items:\n`);
    items.forEach((item, index) => {
      console.log(`${index + 1}. ${item.title}`);
      console.log(`   ${item.url}`);
    });

    // Save to a JSON file named after the input file
    const outputFilename = `${path.parse(filename).name}_extracted.json`;
    const outputData = JSON.stringify(items, null, 2);
    fs.writeFileSync(outputFilename, outputData);
    console.log(`\nResults saved to ${outputFilename}`);

  } catch (error) {
    console.error('An error occurred during parsing:', error);
  }
}

main();
