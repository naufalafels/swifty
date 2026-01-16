import express from "express";
import { getCompanyById, getCompaniesByIds } from "../controllers/companyController.js";

const router = express.Router();

// Batch lookup: GET /api/companies?ids=id1,id2,...
router.get("/", getCompaniesByIds);

// Single lookup: GET /api/companies/:id
router.get("/:id", getCompanyById);

export default router;