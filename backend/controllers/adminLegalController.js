import LegalDoc from '../models/legalDocModel.js';

export const getTerms = async (_req, res) => {
  try {
    const latest = await LegalDoc.findOne().sort({ updatedAt: -1 }).lean();
    return res.json({ success: true, terms: latest?.terms || '' });
  } catch (err) {
    console.error('getTerms error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateTerms = async (req, res) => {
  try {
    const { terms } = req.body || {};
    if (!terms || !terms.trim()) return res.status(400).json({ success: false, message: 'terms required' });

    const doc = new LegalDoc({ terms, updatedBy: req.user.id });
    await doc.save();
    return res.json({ success: true, terms: doc.terms, updatedAt: doc.updatedAt });
  } catch (err) {
    console.error('updateTerms error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Public (no auth) Terms for frontend
export const getPublicTerms = async (_req, res) => {
  try {
    const latest = await LegalDoc.findOne().sort({ updatedAt: -1 }).lean();
    return res.json({ success: true, terms: latest?.terms || '' });
  } catch (err) {
    console.error('getPublicTerms error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};