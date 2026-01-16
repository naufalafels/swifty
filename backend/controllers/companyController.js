import Company from "../models/companyModel.js";

/**
 * GET /api/companies/:id
 * Return a single company by id (public).
 */
export const getCompanyById = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: "Company id required" });
    const company = await Company.findById(id).lean();
    if (!company) return res.status(404).json({ success: false, message: "Company not found" });
    return res.json({
      success: true,
      company: {
        id: company._id,
        name: company.name,
        logo: company.logo || "",
        address: company.address || {},
        location: company.location || null,
      },
    });
  } catch (err) {
    console.error("getCompanyById error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /api/companies?ids=id1,id2,...
 * Batch lookup: returns companies array for provided ids.
 */
export const getCompaniesByIds = async (req, res) => {
  try {
    const idsParam = String(req.query.ids || "").trim();
    if (!idsParam) return res.status(400).json({ success: false, message: "ids query parameter is required" });
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return res.status(400).json({ success: false, message: "No valid ids provided" });

    const companies = await Company.find({ _id: { $in: ids } }).lean();
    const mapped = companies.map((company) => ({
      id: company._id,
      name: company.name,
      logo: company.logo || "",
      address: company.address || {},
      location: company.location || null,
    }));
    return res.json({ success: true, companies: mapped });
  } catch (err) {
    console.error("getCompaniesByIds error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};