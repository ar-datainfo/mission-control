/* weight: 3 = heavy (shown most), 2 = mid, 1 = light. */
const PROJECTS = [
  { id: "collapse", name: "Collapse Signature", weight: 3, stack: "Python, ML, SHAP, Streamlit", desc: "Finds early-warning signatures of collapse in 4,999 years of civilisation data." },
  { id: "flight", name: "Flight Delay Prediction", weight: 3, stack: "XGBoost, PostgreSQL, SHAP, Tableau", desc: "Predicts flight delays and explains the drivers." },
  { id: "funnel", name: "Sales Funnel Analysis", weight: 3, stack: "Pure SQL, Tableau", desc: "Funnel analysis across 109M rows, written entirely in SQL." },
  { id: "quake", name: "Earthquake Risk Dashboard", weight: 3, stack: "USGS API, Streamlit", desc: "Live earthquake risk dashboard built on the USGS API." },
  { id: "rag", name: "RAG Document Assistant", weight: 3, stack: "GPT-4o, LangChain, ChromaDB, Streamlit", desc: "Answers questions over your own documents with retrieval." },
  { id: "rfm", name: "Retail Customer Segmentation", weight: 2, stack: "RFM, K-Means", desc: "Segments customers using RFM and K-Means on 28M+ transactions." },
  { id: "hr", name: "HR Attrition Analysis", weight: 2, stack: "SHAP, BLS API", desc: "Explains why employees leave, with BLS context." },
  { id: "ab", name: "A/B Testing Framework", weight: 2, stack: "Pure SQL, z-score", desc: "Runs experiment analysis in SQL using z-scores." },
  { id: "pokemon", name: "Pokémon Meta Tracker", weight: 2, stack: "XGBoost, ROC-AUC 0.94", desc: "Predicts competitive outcomes with ROC-AUC 0.94." },
  { id: "home", name: "AI Smart Home Analytics", weight: 1, stack: "IoT, anomaly detection", desc: "Detects anomalies in smart home sensor data." },
  { id: "stem", name: "AI Stem Separator", weight: 1, stack: "Audio ML", desc: "Splits songs into vocal and instrument stems." }
];
