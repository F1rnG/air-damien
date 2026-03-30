import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const dist = join(process.cwd(), 'dist');

// sitemap-0.xml has the actual URLs - copy it to sitemap.xml
const sitemap0 = join(dist, 'sitemap-0.xml');
const sitemapOut = join(dist, 'sitemap.xml');

if (existsSync(sitemap0)) {
  const content = readFileSync(sitemap0, 'utf-8');
  writeFileSync(sitemapOut, content);
  console.log('Created sitemap.xml from sitemap-0.xml');
}

// Remove originals
for (const file of ['sitemap-0.xml', 'sitemap-index.xml']) {
  const path = join(dist, file);
  if (existsSync(path)) {
    unlinkSync(path);
    console.log(`Removed ${file}`);
  }
}
