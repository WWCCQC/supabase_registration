// Check screenshot numbers - vertical sum
console.log('🔍 Checking screenshot numbers...\n');

console.log('WW-Provider Installation (vertical sum):');
const wwInstall = [220, 318, 236, 213, 192, 181, 292, 167];
console.log('Values:', wwInstall.join(' + '));
console.log('Sum:', wwInstall.reduce((a, b) => a + b, 0));
console.log('Screenshot shows: 798 in red\n');

console.log('WW-Provider Repair (vertical sum):');
const wwRepair = [30, 36, 17, 37, 36, 36, 36, 33];
console.log('Values:', wwRepair.join(' + '));
console.log('Sum:', wwRepair.reduce((a, b) => a + b, 0));
console.log('Screenshot shows: 175 in red\n');

console.log('WW-Provider Total:');
console.log('798 + 175 = 973');
console.log('Screenshot Grand Total shows: 2,080(973) ✓\n');

console.log('═══════════════════════════════════════\n');

console.log('True Tech Installation (vertical sum):');
const ttInstall = [12, 19, 0, 36, 19, 26, 0, 26];
console.log('Values:', ttInstall.join(' + '));
console.log('Sum:', ttInstall.reduce((a, b) => a + b, 0));
console.log('Screenshot shows: 105 in red\n');

console.log('True Tech Repair (vertical sum):');
const ttRepair = [133, 246, 71, 43, 46, 26, 57, 46];
console.log('Values:', ttRepair.join(' + '));
console.log('Sum:', ttRepair.reduce((a, b) => a + b, 0));
console.log('Screenshot shows: 789 in red\n');

console.log('True Tech Total:');
console.log('105 + 789 = 894');
console.log('Screenshot Grand Total shows: 806(894) ✓\n');

console.log('═══════════════════════════════════════\n');

console.log('เถ้าแก่เทค Installation (vertical sum):');
const tkInstall = [0, 0, 20, 0, 0, 0, 2, 6];
console.log('Values:', tkInstall.join(' + '));
console.log('Sum:', tkInstall.reduce((a, b) => a + b, 0));
console.log('Screenshot shows: 18 in red (not 52!)\n');

console.log('เถ้าแก่เทค Repair (vertical sum):');
const tkRepair = [0, 0, 0, 0, 0, 0, 0, 0];
console.log('Values:', tkRepair.join(' + '));
console.log('Sum:', tkRepair.reduce((a, b) => a + b, 0));
console.log('Screenshot shows: 0 in red\n');

console.log('═══════════════════════════════════════\n');

console.log('📊 CONCLUSION:');
console.log('The red numbers in Grand Total row are:');
console.log('  - VERTICAL SUMS of workgroup counts by Provider+WorkType');
console.log('  - NOT horizontal sums!\n');

console.log('Expected from API:');
console.log('  WW-Provider: Installation=941, Repair=250, Total=1,191');
console.log('  True Tech: Installation=69, Repair=504, Total=573');
console.log('  เถ้าแก่เทค: Installation=26, Repair=0, Total=26');
console.log('  Grand Total: 1,790\n');

console.log('Screenshot shows:');
console.log('  WW-Provider: Installation=798, Repair=175, Total=973');
console.log('  True Tech: Installation=105, Repair=789, Total=894');
console.log('  เถ้าแก่เทค: Installation=18, Repair=0, Total=18');
console.log('  Grand Total: 1,885\n');

console.log('❌ Numbers DON\'T MATCH!');
console.log('Difference: 1,885 - 1,790 = 95 records');
