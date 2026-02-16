import { query } from './src/utils/db.js';

async function checkColumns() {
  try {
    const result = await query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'caregiver_profiles\' ORDER BY ordinal_position');
    console.log('caregiver_profiles columns:');
    result.rows.forEach(row => console.log('- ' + row.column_name + ': ' + row.data_type));
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

checkColumns();
