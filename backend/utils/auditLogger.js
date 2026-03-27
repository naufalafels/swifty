import AuditLog from '../models/auditLogModel.js';

/**
 * Central audit logging utility.
 * Call this from ANY controller when a trackable action occurs.
 *
 * @param {Object} params
 * @param {Object} params.req - Express request (for IP, user-agent)
 * @param {string} params.userId - Who performed the action
 * @param {string} params.userName - Display name
 * @param {string} params.userEmail - Email
 * @param {string} params.companyId - Company scope
 * @param {string} params.category - One of the enum categories
 * @param {string} params.action - Human-readable action string
 * @param {string} params.details - Longer description
 * @param {Object} params.metadata - Structured data (targetType, targetId, previousValue, newValue, etc.)
 * @param {string} params.severity - 'info' | 'warning' | 'critical'
 */
export const createAuditLog = async ({
  req,
  userId,
  userName = '',
  userEmail = '',
  companyId,
  category = 'system',
  action,
  details = '',
  metadata = {},
  severity = 'info',
}) => {
  try {
    await AuditLog.create({
      userId,
      userName,
      userEmail,
      companyId,
      category,
      action,
      details,
      metadata,
      severity,
      ip: req?.ip || req?.connection?.remoteAddress || '',
      userAgent: req?.headers?.['user-agent'] || '',
    });
  } catch (err) {
    // Never let audit logging crash the main flow
    console.error('Audit log creation failed:', err.message);
  }
};