/* Edit topic lists here. Order matters: each track is worked through top to bottom. */
const CURRICULUM = {
  python: { name: "Python", topics: [
    "Variables and data types", "Strings and f-strings", "Lists, tuples and sets", "Dictionaries",
    "Conditionals and control flow", "Loops and comprehensions", "Functions and arguments", "Lambda, map and filter",
    "Error handling", "Reading and writing files", "Modules and virtual environments", "Object-oriented basics",
    "NumPy arrays", "NumPy vectorisation and broadcasting", "Pandas Series and DataFrame", "Selecting and filtering rows",
    "Missing data", "groupby and aggregation", "merge, join and concat", "Pivot and melt",
    "Dates and time series", "Matplotlib basics", "Seaborn for EDA", "Calling APIs with requests", "Writing clean, testable code"
  ]},
  sql: { name: "SQL", topics: [
    "SELECT, WHERE and ORDER BY", "GROUP BY and HAVING", "INNER and LEFT joins", "Anti-joins and self-joins",
    "Subqueries", "CTEs", "CASE WHEN", "ROW_NUMBER, RANK and DENSE_RANK",
    "LAG and LEAD", "Running totals and moving averages", "Date functions", "NULL handling and de-duplication",
    "UNION, INTERSECT and EXCEPT", "Indexes and query performance"
  ]},
  tableau: { name: "Tableau", topics: [
    "Connecting to data", "Dimensions and measures", "Core chart types", "Filters and parameters",
    "Calculated fields", "Table calculations", "LOD expressions", "Dual axis and combined charts",
    "Maps", "Dashboard layout and actions", "Storytelling with data", "Performance and publishing"
  ]},
  stats: { name: "Statistics", topics: [
    "Descriptive statistics", "Distributions", "Probability basics", "Conditional probability and Bayes",
    "Sampling and the CLT", "Confidence intervals", "Hypothesis testing", "t-tests",
    "Chi-square test", "p-values, power and errors", "A/B test design", "Correlation vs causation",
    "Linear regression", "Logistic regression basics"
  ]},
  ml: { name: "Machine Learning", topics: [
    "The ML workflow", "Train/test split and cross-validation", "Feature engineering", "Encoding and scaling",
    "Linear regression in ML", "Logistic regression", "Decision trees", "Random forests",
    "Gradient boosting and XGBoost", "K-Means clustering", "Classification metrics", "Regression metrics",
    "Imbalanced data", "Overfitting and regularisation", "SHAP and interpretability", "Shipping a model with Streamlit"
  ]}
};
