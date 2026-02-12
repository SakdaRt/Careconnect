import { query } from '../utils/db.js';

export const getHealth = async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({
      success: true,
      data: {
        ok: true,
        db: 'ok',
        now: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Admin] Health error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Health check failed',
    });
  }
};

export default { getHealth };

