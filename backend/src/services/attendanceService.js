const Attendance = require('../models/Attendance');
const Batch = require('../models/Batch');
const { Op } = require('sequelize');

/**
 * Get attendance summary for a student (UUID of Student record).
 * Returns per-batch breakdown + overall totals.
 */
const getStudentAttendanceSummary = async (studentId, { month, year, batchId } = {}) => {
  const where = {};
  if (batchId) where.batchId = batchId;
  if (year && month) {
    const y = parseInt(year), m = parseInt(month);
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const end = new Date(y, m, 0).toISOString().slice(0, 10);
    where.date = { [Op.between]: [start, end] };
  } else if (year) {
    where.date = { [Op.between]: [`${year}-01-01`, `${year}-12-31`] };
  }

  const sessions = await Attendance.findAll({
    where,
    include: [{ model: Batch, as: 'batch', attributes: ['batchName'] }],
    order: [['date', 'DESC']],
  });

  let totalClasses = 0, totalPresent = 0, totalAbsent = 0;
  const batchMap = {};

  for (const session of sessions) {
    totalClasses++;
    // records is JSONB: [{studentId, status}, ...]
    const record = (session.records || []).find(r => r.studentId === studentId);
    const status = record ? record.status : 'absent';

    if (status === 'present' || status === 'late') totalPresent++;
    else totalAbsent++;

    const bKey = session.batchId;
    if (!batchMap[bKey]) {
      batchMap[bKey] = {
        batchId: bKey,
        batchName: session.batch ? session.batch.batchName : 'Unknown',
        classes: 0, present: 0, absent: 0, sessions: [],
      };
    }
    batchMap[bKey].classes++;
    if (status === 'present' || status === 'late') batchMap[bKey].present++;
    else batchMap[bKey].absent++;
    batchMap[bKey].sessions.push({ date: session.date, status, subject: session.subject });
  }

  const percentage = totalClasses > 0 ? parseFloat(((totalPresent / totalClasses) * 100).toFixed(2)) : 0;

  return {
    totalClasses, totalPresent, totalAbsent, percentage,
    batches: Object.values(batchMap),
  };
};

module.exports = { getStudentAttendanceSummary };
