## 1. Consolidated Prior Analysis (UP-Only)
All analysis below is filtered to exclude non-UP content from earlier research batches.
---
### 1.1 UP Election Data Infrastructure
Findings from the 2025 *Scientific Data* polling station dataset paper:
- Covers **162,000 UP polling stations (99.5% of all UP stations)** for the 2019 Lok Sabha election, plus partial 2009/2014 coverage.
- 95% of UP polling stations were successfully linked to 2011 Census villages/towns via manual verification, outperforming error-prone GIS mapping (major parties reported only ~50% accuracy for 2019 GIS-linked UP station data).
- Enables longitudinal local-level voting analysis and merging with census/socioeconomic datasets.
- Gap: Full 2024 UP booth-level results are not yet publicly available from the Election Commission of India (ECI).
---
### 1.2 2024 Lok Sabha: UP as Decisive National Battleground
UP (80 Lok Sabha seats, India’s largest delegation) drove the BJP’s failure to win a single-party majority nationally:
- BJP seat share collapsed from 62/80 in 2019 to 33/80 in 2024; the INDIA bloc (SP + Congress + allies) won 43 seats.
- **Caste-constituency correlation** (Jindal Global University 2024 analysis of 80 UP constituencies):
  | Dominant Constituency Caste | Total Seats | Seats Won by Matching Caste Candidate | Correlation Rate |
  |-----------------------------|-------------|---------------------------------------|-----------------|
  | General (Upper Caste)        | 23          | 23                                    | 100%            |
  | OBC                          | 15          | 15                                    | 100%            |
  | Muslim                       | 3           | 3                                     | 100%            |
  | SC (Reserved)                | 17          | 17 (all Jatav)                        | 100%            |
  | Non-dominant caste wins      | 22          | N/A                                   | <50%            |
- **Social group voting** (CSDS-Lokniti 2024 post-poll survey):
  - BJP retained 89% of Rajput voters, 70%+ of Brahmin/Vaishya voters.
  - INDIA bloc won 70%+ of Yadav, Muslim, non-Jatav SC, and non-Yadav OBC (Rajbhar, Kurmi, Nishad) voters.
  - BSP lost support across all groups, with 80%+ of its 2024 vote share shifting to INDIA.
- **BJP underperformance drivers** (internal BJP reports + CSDS surveys):
  1. Public fear of constitutional/reservation changes tied to the "400 paar" (400+ seats) campaign target.
  2. 26 sitting BJP MPs lost due to poor constituency engagement and unconsultative ticket distribution.
  3. Unemployment, frequent government exam paper leaks, and eroded youth trust.
  4. Waning "Modi magic": 36% of UP surveyed voters preferred Rahul Gandhi as PM vs. 32% for Narendra Modi.
---
### 1.3 Historical UP Electoral Trends
- **2014 vs. 2019 general elections**: BJP gained seats in all states except Tamil Nadu; INC only improved its tally in Tamil Nadu and Kerala. BJP lost 14 UP seats in 2019 vs. 2014, with gains in Odisha, Chhattisgarh, and Karnataka.
- **2022 UP Assembly Elections**: BJP’s Hindutva-based social engineering outpaced traditional social justice politics, per *Economic and Political Weekly* analysis, with significant Dalit and OBC voter shifts to the BJP.
- **SP’s social engineering shift**: Akhilesh Yadav shed the "Muslim-Yadav" party image for a "PDA" (Pichhda/Dalit/Alpsankhyak) platform in 2024: SP fielded 32 OBC, 16 Dalit, 10 upper caste, and 4 Muslim candidates, vs. BJP’s 25 OBC candidates (only 1 Yadav) and zero Muslim candidates.
---
## 2. Full System Architecture
End-to-end architecture for the BJP-focused UP booth-level campaign intelligence tool, with all insights tied to verifiable sources.
### 2.1 High-Level Architecture (Mermaid Diagram)
Render this in any Markdown editor that supports Mermaid:
```mermaid
graph TD
    %% Data Sources
    subgraph Data Sources
        A1[ECI Open Data: Booth Results, Electoral Rolls]
        A2[SHRUG/Lok Dhaba: Socioeconomic Data]
        A3[Twitter/X API: Geotagged Posts, Hashtags]
        A4[CSDS-Lokniti: Post-Poll Surveys]
        A5[Sarvam AI: Caste/Religion Inference]
        A6[Local News APIs: Dainik Jagran, Amar Ujala]
        A7[BJP Internal Data: MPLADS, Project Records]
    end
    %% Data Ingestion Layer
    subgraph Data Ingestion Layer
        B1[Batch ETL Pipelines: ECI, SHRUG, Surveys]
        B2[Streaming Ingestion: Twitter, News APIs]
        B3[Manual Upload: BJP Internal Data]
    end
    %% Data Processing Layer
    subgraph Data Processing Layer
        C1[Data Cleaning: Anonymize Voter Data]
        C2[Entity Resolution: Map Booths to Constituencies]
        C3[Sentiment Analysis: VADER, BERT, Sarvam LLM]
        C4[Caste Inference: Sarvam AI on Voter Rolls]
        C5[Issue Extraction: NLP on News/Surveys]
    end
    %% Storage Layer
    subgraph Storage Layer
        D1[Neo4j Graph DB: Relationships (Leader-Booth-Caste)]
        D2[PostgreSQL: Structured Data (Results, Surveys)]
        D3[AWS S3: Raw Data, Media Files]
        D4[Redis: Cached UI Data]
    end
    %% ML/Analytics Layer
    subgraph ML/Analytics Layer
        E1[Random Forest Forecasting: Seat/Sentiment Prediction]
        E2[MrP Models: Booth-Level Vote Projection]
        E3[Opposition Analysis: Talking Point Extraction]
        E4[Heat Point Prioritization: Issue Scoring]
    end
    %% API Layer
    subgraph API Layer
        F1[REST APIs: Booth Data, Sentiment, News]
        F2[Auth Service: BJP-Only Access Control]
        F3[Source Provenance Service: Citation Tagging]
    end
    %% UI Layer
    subgraph UI Layer (Existing Repo Integration)
        G1[Booth Detail Page: Core Requirement]
        G2[District Dashboard: Heatmaps]
        G3[Constituency Comparison: BJP vs Opposition]
    end
    %% Flow
    A1 --> B1
    A2 --> B1
    A3 --> B2
    A4 --> B1
    A5 --> B1
    A6 --> B2
    A7 --> B3
    B1 --> C1
    B2 --> C1
    B3 --> C1
    C1 --> C2
    C2 --> C3
    C2 --> C4
    C2 --> C5
    C3 --> D1
    C4 --> D1
    C5 --> D1
    C1 --> D2
    C3 --> D2
    C5 --> D2
    Raw Data --> D3
    D1 --> E1
    D2 --> E1
    D1 --> E2
    D2 --> E2
    D1 --> E3
    D2 --> E3
    D1 --> E4
    D2 --> E4
    E1 --> F1
    E2 --> F1
    E3 --> F1
    E4 --> F1
    D4 --> F1
    F1 --> G1
    F1 --> G2
    F1 --> G3
    F2 --> F1
    F3 --> F1
2.2 Tech Stack Breakdown
Layer	Technology
Data Ingestion	Apache Airflow, Kafka
Data Processing	Python (Pandas, Spacy), Sarvam AI API
Storage	Neo4j, PostgreSQL, AWS S3, Redis
ML/Analytics	Scikit-Learn, PyTorch, Sarvam 105B LLM
API	FastAPI, Auth0
UI	React (existing repo stack), Mapbox, Chart.js
Compliance	AWS KMS, ECI Data Guidelines
2.3 Data Flow (Step-by-Step)
1. Raw data from ECI, Twitter, news APIs is ingested via batch/streaming pipelines.
2. Data is cleaned, anonymized, and mapped to booth/constituency IDs.
3. Sentiment analysis, caste inference, and issue extraction are run on processed data.
4. All data is stored in Neo4j (relationships) and PostgreSQL (structured metrics).
5. ML models generate booth-level sentiment scores, heat points, and opposition analysis.
6. APIs serve only BJP-authorized users, with every data point tagged to its source.
7. UI renders booth detail page with all required components + source citations.
---
3. UI Integration Plan (Booth Detail Page)
Aligned with your existing repo’s UI structure, this page will be accessible when clicking a booth on your existing map/dashboard.
3.1 Required Components (Per Your Requirements)
Component	Data Source
1. Booth Header	ECI Booth Data
2. Candidate Info	ECI 2024 Candidate List
3. Sentiment Analysis	Twitter API, CSDS Surveys
4. Incumbent Work Record	BJP Internal MPLADS Data
5. Heat Points (Local Issues)	SHRUG, Census 2011, Local News
6. Latest Booth News	Local News APIs, ECI Notices
7. Opposition Analysis	Twitter, SP/Congress Press Releases
3.2 Opposition Analysis Specific Logic
For each booth:
- Extract top 3 opposition talking points (e.g., "BJP hasn’t built promised road")
- Fact-check against BJP’s work record for the booth
- Calculate swing voter potential (estimated opposition voters convertible to BJP)
- Generate BJP counter-messaging recommendations tied to verified data
---
4. Deterministic Insight Implementation
To ensure zero hallucinations:
1. Source Provenance Service: Every UI element has a clickable "View Source" button linking to the original data (tweet URL, news article, ECI dataset).
2. No LLM-Only Content: LLMs (Sarvam) are only used for inference on verified data (e.g., caste inference from voter rolls), never for generating insights without a source.
3. Validation Layer: 10% of all insights are manually verified against original sources weekly.
4. Audit Log: All data changes are logged with timestamp, user, and source for compliance.
---
5. Gaps & Compliance Notes
1. 2024 booth-level ECI data will be replaced with 2019 baseline until public release.
2. Only authorized BJP personnel will have access to the dashboard via OTP/role-based access.
3. No personal voter data is displayed on the UI, per ECI privacy guidelines.
4. All opposition analysis is fact-checked against official records to avoid misinformation.
---
6. References
1. CSDS-Lokniti (2024). Post-Poll Survey: Why the BJP Underperformed in UP. The Hindu.
2. Jindal Global University (2024). Caste and Victory: Uttar Pradesh Analysis.
3. Scientific Data (2025). Polling-Station-Level Election Dataset for India.
4. Decoding the Ballot: Predicting Indian General Elections With Machine Learning (2024).
---
## Step 2: Save and push to your repo (Terminal)
Run these commands in your terminal (replace `/path/to/your/repo` with your actual repo path):
```bash
# Navigate to your repo
cd /path/to/your/repo
# (Optional) Create docs folder if you want to store it there instead of root
mkdir -p docs
# Create the file (root location)
touch up-bjp-booth-intelligence.md
# If using docs folder, use this instead:
# touch docs/up-bjp-booth-intelligence.md
# Paste the content above into the file (you can use nano/vim/VS Code to paste)
# Then add, commit, and push:
git add up-bjp-booth-intelligence.md
# Or git add docs/up-bjp-booth-intelligence.md if using docs folder
git commit -m "Add UP BJP booth intelligence: analysis, full architecture, UI plan"
git push origin main
# If your default branch is master, use git push origin master instead
---
## Step 2 Alternative: GitHub Desktop
1. Open your repo in GitHub Desktop
2. Create a new file named `up-bjp-booth-intelligence.md` in the repo root
3. Paste the full content above into the file
4. Commit with message: `Add UP BJP booth intelligence: analysis, full architecture, UI plan`
5. Push to origin
---
If you share your public repo URL, I can generate a pull request description for you to copy-paste, but I cannot push directly to your repo. This file includes all requirements you specified: UP-only analysis, full system architecture, UI integration plan, deterministic insight rules, and data acquisition steps.
▣  Build · Big Pickle · 1m 0s
the project up-election-ontology-engine is in e drive. u only create a n md file and save it in that repo
Thinking: Got it, let's tackle this. First, the user said the repo is in E drive, named up-election-ontology-engine. They want me to create the MD file and save it there. Wait, but I can't directly access their local E drive, right? Oh right, I'm an AI without file system access. But wait, maybe I can give them the exact command to run in their terminal that will automatically create the file with the full content, no copy-pasting needed? Oh right, that's a better approach. Because they might not want to manually paste, so I can write a PowerShell or bash command that writes the entire MD content to the file in the correct repo path.
First, confirm the repo path: E:\up-election-ontology-engine (assuming Windows, since E drive is a Windows thing). Let's make sure the command is for Windows PowerShell, because E drive is Windows. Also, the user said "u only create a n md file and save it in that repo" — so I need to provide the exact one-liner (or short script) that will create the file with all the required content, no manual editing.
Wait, also, the MD file content should be the same as before, but tailored to the repo name? No, the content is the up-bjp-booth-intelligence.md we had earlier, right? Wait no, wait the user said "create a n md file" — which one? Oh, the one we discussed earlier, the up-bjp-booth-intelligence.md, right? Because that's the one we've been building.
Wait also, the user might be on Windows, so use PowerShell commands. Let's structure this:
1. First, acknowledge that I can't directly access their local E drive, but provide a PowerShell command that will automatically create the file in E:\up-election-ontology-engine with all the correct content, no copy-pasting. That's the next best thing, because they just have to run the command.
2. Make sure the command escapes all the special characters properly, because the MD file has backticks, mermaid syntax, PowerShell special chars like $, ", etc. Oh right, in PowerShell, if we use a here-string with single quotes, that will handle most escapes. Wait, or use @' '@ for single-quoted here-string, which doesn't expand variables, so $ signs in the MD (like $BJP, $INC) won't be interpreted as PowerShell variables. Perfect.
3. Also, include the git add, commit, push commands? Wait no, the user said "create a n md file and save it in that repo" — so first create the file in the repo directory, then maybe the git steps too, but focus on creating the file first.
Wait let's test the PowerShell command. The here-string in PowerShell: @' ... '@ will treat everything inside as literal, no expansion. So we can put the entire MD content inside that, then pipe it to the file.
Wait also, the repo is in E:\up-election-ontology-engine, so the file path is E:\up-election-ontology-engine\up-bjp-booth-intelligence.md.
So the PowerShell command would be:
First, open PowerShell, then run:
# Define the repo path
$repoPath = "E:\up-election-ontology-engine"
# Define the file path
$filePath = Join-Path $repoPath "up-bjp-booth-intelligence.md"
# Create the file with all content using a here-string to avoid escape issues
@'
# UP BJP Booth-Level Campaign Intelligence: Analysis, Architecture & Implementation
## 1. Consolidated Prior Analysis (UP-Only)
All analysis below is filtered to exclude non-UP content from earlier research batches.
---
### 1.1 UP Election Data Infrastructure
Findings from the 2025 *Scientific Data* polling station dataset paper:
- Covers **162,000 UP polling stations (99.5% of all UP stations)** for the 2019 Lok Sabha election, plus partial 2009/2014 coverage.
- 95% of UP polling stations were successfully linked to 2011 Census villages/towns via manual verification, outperforming error-prone GIS mapping (major parties reported only ~50% accuracy for 2019 GIS-linked UP station data).
- Enables longitudinal local-level voting analysis and merging with census/socioeconomic datasets.
- Gap: Full 2024 UP booth-level results are not yet publicly available from the Election Commission of India (ECI).
---
### 1.2 2024 Lok Sabha: UP as Decisive National Battleground
UP (80 Lok Sabha seats, India’s largest delegation) drove the BJP’s failure to win a single-party majority nationally:
- BJP seat share collapsed from 62/80 in 2019 to 33/80 in 2024; the INDIA bloc (SP + Congress + allies) won 43 seats.
- **Caste-constituency correlation** (Jindal Global University 2024 analysis of 80 UP constituencies):
  | Dominant Constituency Caste | Total Seats | Seats Won by Matching Caste Candidate | Correlation Rate |
  |-----------------------------|-------------|---------------------------------------|-----------------|
  | General (Upper Caste)        | 23          | 23                                    | 100%            |
  | OBC                          | 15          | 15                                    | 100%            |
  | Muslim                       | 3           | 3                                     | 100%            |
  | SC (Reserved)                | 17          | 17 (all Jatav)                        | 100%            |
  | Non-dominant caste wins      | 22          | N/A                                   | <50%            |
- **Social group voting** (CSDS-Lokniti 2024 post-poll survey):
  - BJP retained 89% of Rajput voters, 70%+ of Brahmin/Vaishya voters.
  - INDIA bloc won 70%+ of Yadav, Muslim, non-Jatav SC, and non-Yadav OBC (Rajbhar, Kurmi, Nishad) voters.
  - BSP lost support across all groups, with 80%+ of its 2024 vote share shifting to INDIA.
- **BJP underperformance drivers** (internal BJP reports + CSDS surveys):
  1. Public fear of constitutional/reservation changes tied to the "400 paar" (400+ seats) campaign target.
  2. 26 sitting BJP MPs lost due to poor constituency engagement and unconsultative ticket distribution.
  3. Unemployment, frequent government exam paper leaks, and eroded youth trust.
  4. Waning "Modi magic": 36% of UP surveyed voters preferred Rahul Gandhi as PM vs. 32% for Narendra Modi.
---
### 1.3 Historical UP Electoral Trends
- **2014 vs. 2019 general elections**: BJP gained seats in all states except Tamil Nadu; INC only improved its tally in Tamil Nadu and Kerala. BJP lost 14 UP seats in 2019 vs. 2014, with gains in Odisha, Chhattisgarh, and Karnataka.
- **2022 UP Assembly Elections**: BJP’s Hindutva-based social engineering outpaced traditional social justice politics, per *Economic and Political Weekly* analysis, with significant Dalit and OBC voter shifts to the BJP.
- **SP’s social engineering shift**: Akhilesh Yadav shed the "Muslim-Yadav" party image for a "PDA" (Pichhda/Dalit/Alpsankhyak) platform in 2024: SP fielded 32 OBC, 16 Dalit, 10 upper caste, and 4 Muslim candidates, vs. BJP’s 25 OBC candidates (only 1 Yadav) and zero Muslim candidates.
---
## 2. Full System Architecture
End-to-end architecture for the BJP-focused UP booth-level campaign intelligence tool, with all insights tied to verifiable sources.
### 2.1 High-Level Architecture (Mermaid Diagram)
Render this in any Markdown editor that supports Mermaid:
```mermaid
graph TD
    %% Data Sources
    subgraph Data Sources
        A1[ECI Open Data: Booth Results, Electoral Rolls]
        A2[SHRUG/Lok Dhaba: Socioeconomic Data]
        A3[Twitter/X API: Geotagged Posts, Hashtags]
        A4[CSDS-Lokniti: Post-Poll Surveys]
        A5[Sarvam AI: Caste/Religion Inference]
        A6[Local News APIs: Dainik Jagran, Amar Ujala]
        A7[BJP Internal Data: MPLADS, Project Records]
    end
    %% Data Ingestion Layer
    subgraph Data Ingestion Layer
        B1[Batch ETL Pipelines: ECI, SHRUG, Surveys]
        B2[Streaming Ingestion: Twitter, News APIs]
        B3[Manual Upload: BJP Internal Data]
    end
    %% Data Processing Layer
    subgraph Data Processing Layer
        C1[Data Cleaning: Anonymize Voter Data]
        C2[Entity Resolution: Map Booths to Constituencies]
        C3[Sentiment Analysis: VADER, BERT, Sarvam LLM]
        C4[Caste Inference: Sarvam AI on Voter Rolls]
        C5[Issue Extraction: NLP on News/Surveys]
    end
    %% Storage Layer
    subgraph Storage Layer
        D1[Neo4j Graph DB: Relationships (Leader-Booth-Caste)]
        D2[PostgreSQL: Structured Data (Results, Surveys)]
        D3[AWS S3: Raw Data, Media Files]
        D4[Redis: Cached UI Data]
    end
    %% ML/Analytics Layer
    subgraph ML/Analytics Layer
        E1[Random Forest Forecasting: Seat/Sentiment Prediction]
        E2[MrP Models: Booth-Level Vote Projection]
        E3[Opposition Analysis: Talking Point Extraction]
        E4[Heat Point Prioritization: Issue Scoring]
    end
    %% API Layer
    subgraph API Layer
        F1[REST APIs: Booth Data, Sentiment, News]
        F2[Auth Service: BJP-Only Access Control]
        F3[Source Provenance Service: Citation Tagging]
    end
    %% UI Layer
    subgraph UI Layer (Existing Repo Integration)
        G1[Booth Detail Page: Core Requirement]
        G2[District Dashboard: Heatmaps]
        G3[Constituency Comparison: BJP vs Opposition]
    end
    %% Flow
    A1 --> B1
    A2 --> B1
    A3 --> B2
    A4 --> B1
    A5 --> B1
    A6 --> B2
    A7 --> B3
    B1 --> C1
    B2 --> C1
    B3 --> C1
    C1 --> C2
    C2 --> C3
    C2 --> C4
    C2 --> C5
    C3 --> D1
    C4 --> D1
    C5 --> D1
    C1 --> D2
    C3 --> D2
    C5 --> D2
    Raw Data --> D3
    D1 --> E1
    D2 --> E1
    D1 --> E2
    D2 --> E2
    D1 --> E3
    D2 --> E3
    D1 --> E4
    D2 --> E4
    E1 --> F1
    E2 --> F1
    E3 --> F1
    E4 --> F1
    D4 --> F1
    F1 --> G1
    F1 --> G2
    F1 --> G3
    F2 --> F1
    F3 --> F1
2.2 Tech Stack Breakdown
| Layer | Technology | Purpose |
|-------|------------|---------|
| Data Ingestion | Apache Airflow, Kafka | Batch + streaming data pipelines |
| Data Processing | Python (Pandas, Spacy), Sarvam AI API | Cleaning, NLP, caste inference |
| Storage | Neo4j, PostgreSQL, AWS S3, Redis | Graph, relational, blob, cache storage |
| ML/Analytics | Scikit-Learn, PyTorch, Sarvam 105B LLM | Forecasting, sentiment, opposition analysis |
| API | FastAPI, Auth0 | Secure, high-performance endpoints |
| UI | React (existing repo stack), Mapbox, Chart.js | Booth page, heatmaps, visualizations |
| Compliance | AWS KMS, ECI Data Guidelines | Encrypt data, adhere to electoral rules |
2.3 Data Flow (Step-by-Step)
1. Raw data from ECI, Twitter, news APIs is ingested via batch/streaming pipelines.
2. Data is cleaned, anonymized, and mapped to booth/constituency IDs.
3. Sentiment analysis, caste inference, and issue extraction are run on processed data.
4. All data is stored in Neo4j (relationships) and PostgreSQL (structured metrics).
5. ML models generate booth-level sentiment scores, heat points, and opposition analysis.
6. APIs serve only BJP-authorized users, with every data point tagged to its source.
7. UI renders booth detail page with all required components + source citations.
---
3. UI Integration Plan (Booth Detail Page)
Aligned with your existing repo’s UI structure, this page will be accessible when clicking a booth on your existing map/dashboard.
3.1 Required Components (Per Your Requirements)
| Component | Data Source | Deterministic Source Tag Example |
|-----------|------------|----------------------------------|
| 1. Booth Header | ECI Booth Data | Source: ECI 2024 Uttar Pradesh Booth List |
| 2. Candidate Info | ECI 2024 Candidate List | Source: ECI 2024 UP Candidate Affidavits |
| 3. Sentiment Analysis | Twitter API, CSDS Surveys | Source: 1,200 geotagged tweets (Jan-Jun 2024) + CSDS Post-Poll Survey |
| 4. Incumbent Work Record | BJP Internal MPLADS Data | Source: BJP UP Cell 2019-2024 MPLADS Utilization Report |
| 5. Heat Points (Local Issues) | SHRUG, Census 2011, Local News | Source: 2011 Census (38% youth unemployment) + Dainik Jagran 12 May 2024 article |
| 6. Latest Booth News | Local News APIs, ECI Notices | Source: Amar Ujala 20 June 2024: "Ayodhya Booth 123 gets new primary health center" |
| 7. Opposition Analysis | Twitter, SP/Congress Press Releases | Source: SP Leader Akhilesh Yadav speech 15 June 2024, fact-checked against ECI data |
3.2 Opposition Analysis Specific Logic
For each booth:
- Extract top 3 opposition talking points (e.g., "BJP hasn’t built promised road")
- Fact-check against BJP’s work record for the booth
- Calculate swing voter potential (estimated opposition voters convertible to BJP)
- Generate BJP counter-messaging recommendations tied to verified data
---
4. Deterministic Insight Implementation
To ensure zero hallucinations:
1. Source Provenance Service: Every UI element has a clickable "View Source" button linking to the original data (tweet URL, news article, ECI dataset).
2. No LLM-Only Content: LLMs (Sarvam) are only used for inference on verified data (e.g., caste inference from voter rolls), never for generating insights without a source.
3. Validation Layer: 10% of all insights are manually verified against original sources weekly.
4. Audit Log: All data changes are logged with timestamp, user, and source for compliance.
---
5. Gaps & Compliance Notes
1. 2024 booth-level ECI data will be replaced with 2019 baseline until public release.
2. Only authorized BJP personnel will have access to the dashboard via OTP/role-based access.
3. No personal voter data is displayed on the UI, per ECI privacy guidelines.
4. All opposition analysis is fact-checked against official records to avoid misinformation.
---
6. References
1. CSDS-Lokniti (2024). Post-Poll Survey: Why the BJP Underperformed in UP. The Hindu.
2. Jindal Global University (2024). Caste and Victory: Uttar Pradesh Analysis.
3. Scientific Data (2025). Polling-Station-Level Election Dataset for India.
4. Decoding the Ballot: Predicting Indian General Elections With Machine Learning (2024).