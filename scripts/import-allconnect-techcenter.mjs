// Compatibility entry point. Whole-table replacement is intentionally retired.
const [filePath, mode] = process.argv.slice(2);
if (!filePath || mode !== '--append-new-dates') {
  throw new Error('Whole-table replacement is disabled. Use: node --experimental-strip-types scripts/import-allconnect-new-dates.mjs file.csv --preview (then --commit), or this script with --append-new-dates.');
}
process.argv[3] = '--commit';
await import('./import-allconnect-new-dates.mjs');
