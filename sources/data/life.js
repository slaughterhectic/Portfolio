/**
 * Gourav's life: places, people, conversations and missions.
 * Every fact below comes from Gourav's resume.
 */
export const links = {
    codegang: 'https://codegang.in',
    github: 'https://github.com/slaughterhectic',
    linkedin: 'https://www.linkedin.com/in/gourav-chakraborty-412349204',
    x: 'https://x.com/HecticSlaughter',
    mail: 'mailto:gchakraborty996@gmail.com',
}

export const places = {
    home:     { x: 78,   z: 21.5, width: 10, depth: 7 },
    codegang: { x: 78.5, z: 51, width: 7.5, depth: 8.7, label: 'CODEGANG', sub: 'codegang.in', wall: '#2b2440', accent: '#8cff5a', roof: '#3a3157', model: 'buildingSmallModel', modelScale: 0.6 },
    mathco:   { x: 68.4, z: 21.6, width: 6.4, depth: 5.6, label: 'MATHCO', sub: 'Product Engineering', accent: '#ff7a1a', model: 'buildingMediumModel', modelScale: 0.42 },
}

export const signposts = [
    { x: 31.5, z: 9.6,  label: 'MATHCO', sub: 'Product Engineering · 2025 – now', accent: '#ff7a1a' },
    { x: 19.6, z: 32.6, label: 'KIIT',   sub: 'B.Tech CSE · 2021 – 2025',         accent: '#4ade80' },
    { x: 24.4, z: 15.2, label: 'RESEARCH', sub: 'UK patent · 2 publications',     accent: '#a78bfa' },
]

export const spawn = {
    foot:    { x: 79.4, z: 21.9, angle: - Math.PI * 0.5 },
    vehicle: { x: 82, z: 29.6, rotation: - Math.PI * 0.5 },
}

// [ type, x, z, yaw ] : spots are adjusted to the closest free ground at start
export const parkedVehicles = [
    [ 'motorbike', 77.4, 29.8, - Math.PI * 0.5 ],
    [ 'bicycle',   74.2, 27.4, 0 ],
    [ 'sports',    73.5, 50,   Math.PI * 0.5 ],
    [ 'suv',       45,   35.5, 0.4 ],
    [ 'bicycle',   52.5, 37.5, 1 ],
    [ 'police',    38.5, 20.5, 0 ],
    [ 'vespa',     23,   10.5, Math.PI * 0.5 ],
    [ 'pickup',    20.5, 21.5, 0 ],
    [ 'motorbike', 25.7, - 11, 0 ],
    [ 'sports',    67,   18.5, 0.3 ],
    [ 'vespa',     17.5, 38.5, 2 ],
    [ 'suv',       55,   46.5, - 1 ],
]

// Dogs and cats that can be tamed (E): they follow the player until told to stay
export const pets = [
    { id: 'mochi', name: 'Mochi', kind: 'shiba', position: [ 76.5, 31.5 ] },
    { id: 'pixel', name: 'Pixel', kind: 'cat',   position: [ 81.5, 27.2 ] },
    { id: 'storm', name: 'Storm', kind: 'husky', position: [ 73, 55 ] },
    { id: 'byte',  name: 'Byte',  kind: 'cat',   position: [ 47.5, 41 ] },
    { id: 'rex',   name: 'Rex',   kind: 'shiba', position: [ 24.5, 6 ] },
    { id: 'kernel', name: 'Kernel', kind: 'husky', position: [ 16.5, 21.5 ] },
]

export const outfits = [
    { name: 'Founder hoodie', look: { shirt: '#1f1f24', pants: '#2b2f3a', shoes: '#8cff5a', sleeves: 'long',  legs: 'long',   top: 'normal' } },
    { name: 'Office shirt',   look: { shirt: '#f4f1ea', pants: '#1f2a44', shoes: '#3a2a20', sleeves: 'long',  legs: 'long',   top: 'normal' } },
    { name: 'Weekend tee',    look: { shirt: '#ff5a36', pants: '#262b45', shoes: '#ffffff', sleeves: 'short', legs: 'long',   top: 'normal' } },
    { name: 'Kurta',          look: { shirt: '#e8d9b8', pants: '#f3ede0', shoes: '#7a4a34', sleeves: 'long',  legs: 'long',   top: 'long' } },
    { name: 'Gym',            look: { shirt: '#6b7280', pants: '#111318', shoes: '#ff3b3b', sleeves: 'none',  legs: 'shorts', top: 'normal' } },
    { name: 'Beach',          look: { shirt: '#22d3ee', pants: '#f97316', shoes: '#f5f5f4', sleeves: 'short', legs: 'shorts', top: 'normal' } },
    { name: 'Night out',      look: { shirt: '#7c3aed', pants: '#0f0f14', shoes: '#f1f1f1', sleeves: 'long',  legs: 'long',   top: 'normal' } },
]

export const npcs = [
    {
        id: 'aarav',
        name: 'Aarav',
        role: 'CodeGang · teammate',
        position: [ 76.6, 55.8 ],
        look: { sleeves: 'long', shirt: '#8cff5a', pants: '#1b1b26', hair: '#0e0c0c', skin: '#b9794f', shoes: '#22222c' },
        greeting: `Hey! Welcome to <strong>CodeGang</strong>. Gourav founded this place in 2023 and still architects the product. What do you want to know?`,
        topics: [
            {
                label: 'What is CodeGang?',
                lines: [
                    `CodeGang is a <strong>multi-tenant SaaS collaboration platform</strong>. Clients and developers run the whole project lifecycle on it: milestones, tracking and automated billing.`,
                    `It serves <strong>50+ clients and developers</strong>, and Gourav is the Founder & Product Architect.`,
                ]
            },
            {
                label: 'How is it built?',
                lines: [
                    `FastAPI backend with JWT auth and RBAC, a normalized PostgreSQL schema that isolates every tenant, a React frontend, real-time WebSocket notifications and S3-backed file management.`,
                    `The asynchronous processing layer is event-driven, with message queues and async task orchestration. It handles <strong>1,000+ concurrent users</strong> with <strong>sub-100ms</strong> API responses, released through Azure CI/CD with zero downtime.`,
                ]
            },
            {
                label: 'What has the gang shipped?',
                lines: [
                    `<strong>30+ end-to-end SaaS, web and GenAI engagements</strong> for global clients in e-commerce, supply chain, fintech and edtech, including more than a year of direct work with Fortune-500 companies.`,
                    `There is also an AI layer: a RAG pipeline doing semantic search across <strong>50+ client codebases</strong> with Sentence-BERT and Pinecone at sub-50ms. Every active client adopted it within 2 months.`,
                ]
            },
            { label: 'Open codegang.in', url: links.codegang },
        ]
    },
    {
        id: 'meera',
        name: 'Meera',
        role: 'MathCo · engagement lead',
        position: [ 29.6, 8.4 ],
        look: { sleeves: 'long', top: 'long', body: 'female', hairStyle: 'Long', shirt: '#ff7a1a', pants: '#2c3550', hair: '#2a1710', skin: '#c98f66', shoes: '#f4f4f4' },
        greeting: `Gourav works here at <strong>MathCo</strong> as a Product Engineer I, in the Product Engineering service line. Ask away.`,
        topics: [
            {
                label: 'What does he do at MathCo?',
                lines: [
                    `Since <strong>August 2025</strong> he has been architecting enterprise-scale AI decision intelligence and Generative AI systems for Fortune-50 CPG clients, <strong>Coca-Cola and Unilever</strong>, owning delivery from data pipeline design to Azure deployment.`,
                    `His ML microservices on Azure App Services hold <strong>99.9% uptime</strong> and power executive forecasting dashboards with <strong>95%+ model accuracy</strong>. He also cut batch inference latency by <strong>40%</strong>.`,
                ]
            },
            {
                label: 'The Best Intern story',
                lines: [
                    `He joined as an Analyst Intern in January 2025 and was <strong>awarded Best Intern of the entire cohort</strong>.`,
                    `He built a production-grade Demand–Supply Planning system for Coca-Cola India: an XGBoost pipeline over <strong>2M+ time-series rows</strong> at 92% accuracy across 500+ SKUs.`,
                    `Constraint-based optimization cut supply–demand mismatch by <strong>30%</strong>, an estimated <strong>$1.2M+</strong> saved in inventory costs. Deployments went from days to under 30 minutes.`,
                ]
            },
        ]
    },
    {
        id: 'rao',
        name: 'Prof. Rao',
        role: 'KIIT · faculty',
        position: [ 18, 34 ],
        look: { sleeves: 'long', beard: true, hairStyle: 'Buzzed', shirt: '#f5f0e6', pants: '#5a4634', hair: '#8d8d8d', skin: '#a9714b', shoes: '#3a2a20' },
        greeting: `Ah, a visitor. Gourav studied here at <strong>KIIT, Bhubaneswar</strong>, from 2021 to 2025.`,
        topics: [
            {
                label: 'How did he do?',
                lines: [
                    `B.Tech in Computer Science with a <strong>CGPA of 8.97 / 10</strong>, a minor in Quantum Computing, and honors in Distributed Systems, Quantum Computing and High-Speed Networking.`,
                    `Before that: Hem Sheela Model School, 94.67% in class XII and 95.17% in class X.`,
                ]
            },
            {
                label: 'Life outside class',
                lines: [
                    `He was <strong>National Hackathon Coordinator</strong> at Konnexions: a 20+ member team, <strong>900+ participants</strong> from 50+ colleges, and $50K+ in sponsorships from Google Cloud, Microsoft Azure and GitHub.`,
                    `As <strong>Machine Learning Lead</strong> of the KIIT student chapter he ran 12+ workshops for 500+ students and mentored 25+ projects. 80% of them reached publication or industry deployment.`,
                ]
            },
        ]
    },
    {
        id: 'iyer',
        name: 'Dr. Iyer',
        role: 'Research mentor',
        position: [ 22.5, 16.6 ],
        look: { sleeves: 'long', shirt: '#5b3fd6', pants: '#23263a', hair: '#1c1512', skin: '#8f5c3b', shoes: '#f1f1f1' },
        greeting: `You found the research corner. Gourav has <strong>two peer-reviewed publications</strong> and an accepted <strong>UK patent</strong>.`,
        topics: [
            {
                label: 'The UK patent',
                lines: [
                    `A <strong>Road Anomaly Detection System</strong>. A real-time computer-vision pipeline with YOLOv8 and OpenCV running on a Raspberry Pi 4: <strong>94% precision, 91% recall at 30 FPS</strong>.`,
                    `It geo-tags every pothole by GPS and alerts municipal authorities by SMS and email. Post-training quantization shrank the model by 60%.`,
                ]
            },
            {
                label: 'The publications',
                lines: [
                    `<strong>ICMLDE 2024</strong>: a hybrid ResNet50–Transformer model classifying Alzheimer's from MRI in 4 stages, 96.2% accuracy on ADNI.`,
                    `<strong>OCIT 2024</strong>: an attention-enhanced ResNet50 for retinal disease classification, 93.7% F1 on 35,000+ fundus images.`,
                ]
            },
        ]
    },
    {
        id: 'lucas',
        name: 'Lucas',
        role: 'Osten Group · Brazil',
        position: [ 30.5, 19.4 ],
        look: { legs: 'shorts', shirt: '#f2c230', pants: '#2f5d3a', hair: '#3b2414', skin: '#d9a47c', shoes: '#ffffff' },
        greeting: `Olá! I'm with <strong>Osten Group</strong> in Brazil. Gourav built our chatbot platform.`,
        topics: [
            {
                label: 'What did he build for you?',
                lines: [
                    `A <strong>multi-tenant RAG chatbot platform</strong>: LangChain, OpenAI and Anthropic models, and vector databases, answering questions over enterprise documents across our subsidiaries.`,
                    `Each tenant has isolated vector indices. Hybrid semantic + keyword search with re-ranking keeps end-to-end query latency <strong>under 300ms</strong>.`,
                    `He added a RAGAS evaluation harness and production LLM monitoring, deployed on Azure with token-streaming WebSocket APIs.`,
                ]
            },
            {
                label: 'Any other projects?',
                lines: [
                    `<strong>Resume AI</strong>: job tailoring plus a real-time AI interviewer with Whisper speech-to-text, TTS and streamed LLM answers that gives live STAR-method feedback.`,
                    `And a <strong>custom payment & expense tracker</strong> for a B2B supply-chain client: double-entry ledger, vendor reconciliation, multi-currency, automated GST reporting and cash-flow forecasting.`,
                ]
            },
        ]
    },
    {
        id: 'riya',
        name: 'Riya',
        role: 'Tech recruiter',
        position: [ 44.2, 41.6 ],
        look: { body: 'female', hairStyle: 'Buns', shirt: '#e8427c', pants: '#f0e9df', hair: '#120d0c', skin: '#c58a63', shoes: '#e8427c' },
        greeting: `Hi! I've been reading up on <strong>Gourav Chakraborty</strong>. Full-Stack AI/ML Engineer, based in Bengaluru. Want the short version?`,
        topics: [
            {
                label: 'Give me the summary',
                lines: [
                    `<strong>7+ years</strong> of freelance SaaS development plus Fortune-500 enterprise delivery for clients like Coca-Cola and Unilever.`,
                    `He architects Generative AI, agentic AI and RAG systems on AWS, Azure and GCP. He is a <strong>Microsoft Certified Azure Administrator</strong>, holds a UK patent and has two peer-reviewed deep-learning papers.`,
                ]
            },
            {
                label: 'What is his stack?',
                lines: [
                    `Python, TypeScript, SQL and C++. FastAPI, React, PostgreSQL, Kafka, Docker and Kubernetes.`,
                    `On the AI side: LangChain, LlamaIndex, fine-tuning with LoRA and QLoRA, vector databases, MCP and RAGAS, with XGBoost, time-series forecasting and YOLOv8 for classic ML.`,
                ]
            },
            { label: 'LinkedIn', url: links.linkedin },
            { label: 'GitHub', url: links.github },
            { label: 'Email him', url: links.mail },
        ]
    },
    {
        id: 'sponsorCloud',
        name: 'Cloud rep',
        role: 'Hackathon sponsor',
        position: [ 9.5, 33.5 ],
        look: { sleeves: 'long', shirt: '#3b82f6', pants: '#e5e7eb', hair: '#3a2a1c', skin: '#d6a47e', shoes: '#111111' },
        greeting: `A hackathon with 900+ participants? Google Cloud credits are on the table.`,
        topics: []
    },
    {
        id: 'sponsorAzure',
        name: 'Azure rep',
        role: 'Hackathon sponsor',
        position: [ 14, 39.6 ],
        look: { sleeves: 'long', shirt: '#0ea5e9', pants: '#1f2937', hair: '#0f0d0c', skin: '#a56f4a', shoes: '#f4f4f4' },
        greeting: `50+ colleges taking part? Microsoft Azure is in.`,
        topics: []
    },
    {
        id: 'sponsorGit',
        name: 'GitHub rep',
        role: 'Hackathon sponsor',
        position: [ 20.5, 38.2 ],
        look: { shirt: '#1f1f24', pants: '#4b5563', hair: '#b4532a', skin: '#e0b08c', shoes: '#f4f4f4' },
        greeting: `Open source prizes for every winning team. GitHub will back it.`,
        topics: []
    },
]

export const walkers = [
    { look: { shirt: '#f97316', pants: '#334155', hair: '#1a1210', skin: '#c08860' }, path: [ [ 39.5, 37.8 ], [ 49.2, 34.6 ], [ 55.1, 44 ], [ 49.2, 34.6 ] ] },
    { look: { shirt: '#22c55e', pants: '#3f3f46', hair: '#5a3a22', skin: '#e2b592' }, path: [ [ 35.8, 17.6 ], [ 26, 17 ], [ 17.9, 18.8 ], [ 26, 17 ] ] },
    { look: { shirt: '#eab308', pants: '#1e293b', hair: '#0d0b0b', skin: '#9c6644' }, path: [ [ 70.5, 25 ], [ 77, 31 ], [ 76.5, 43 ], [ 77, 31 ] ] },
]

export const missions = [
    {
        id: 'firstLight',
        title: 'First light',
        auto: true,
        intro: `Morning in Bengaluru. Time to head out.`,
        steps: [
            { type: 'leaveHome', text: 'Walk out of the front door' },
            { type: 'enterVehicle', text: 'Get in a vehicle: your truck, the motorbike or the bicycle (F)' },
            { type: 'reach', position: [ 74.5, 44 ], radius: 3, mode: 'vehicle', text: 'Drive south to the CodeGang HQ' },
        ],
        reward: `You're on the road. Talk to people around the island to learn Gourav's story, and take their missions.`
    },
    {
        id: 'shipIt',
        title: 'Ship it',
        giver: 'aarav',
        pitch: `Five client briefs blew across the plaza. Grab them all and bring them back, we have a release to ship.`,
        steps: [
            { type: 'collect', text: 'Collect the client briefs', points: [ [ 73.5, 45 ], [ 84, 45 ], [ 78, 38 ], [ 71.5, 56 ], [ 84.5, 50.5 ] ] },
            { type: 'talk', npc: 'aarav', text: 'Bring the briefs back to Aarav' },
        ],
        reward: `Shipped. <strong>CodeGang</strong>: 50+ clients and developers, 30+ engagements delivered, founded by Gourav in 2023.`
    },
    {
        id: 'bestIntern',
        title: 'Demand & supply',
        giver: 'meera',
        pitch: `Three distribution centres need this week's forecast before the trucks leave. You have the wheels. Go.`,
        steps: [
            { type: 'collect', mode: 'vehicle', ordered: true, timeLimit: 100, text: 'Deliver the forecast to each distribution centre', points: [ [ 25.7, -14.5 ], [ 48.8, -11.5 ], [ 70, 17.5 ] ] },
            { type: 'talk', npc: 'meera', text: 'Report back to Meera' },
        ],
        reward: `Delivered on time. That planning system won Gourav <strong>Best Intern</strong> at MathCo and saved an estimated $1.2M+ in inventory costs.`
    },
    {
        id: 'roadPatrol',
        title: 'Road anomaly patrol',
        giver: 'iyer',
        pitch: `The patented detector is mounted on your car. Drive over the potholes it flags so we can geo-tag them.`,
        steps: [
            { type: 'collect', mode: 'vehicle', text: 'Drive over every flagged pothole', points: [ [ 17.9, 18.8 ], [ 15.6, 36.4 ], [ 39.5, 35.5 ], [ 52.2, 26.2 ], [ 35.8, 15.5 ], [ 26.3, 5.5 ] ] },
            { type: 'talk', npc: 'iyer', text: 'Return to Dr. Iyer' },
        ],
        reward: `All anomalies geo-tagged. The real system hits 94% precision at 30 FPS on a Raspberry Pi 4, and earned a <strong>UK patent</strong>.`
    },
    {
        id: 'hackathon',
        title: 'Hackathon day',
        giver: 'rao',
        pitch: `The national hackathon needs sponsors. Three reps are around this plaza today. Go and win them over, on foot.`,
        steps: [
            { type: 'talkAll', npcs: [ 'sponsorCloud', 'sponsorAzure', 'sponsorGit' ], text: 'Talk to the three sponsors nearby' },
            { type: 'talk', npc: 'rao', text: 'Tell Prof. Rao the good news' },
        ],
        reward: `Sponsors secured. Gourav's real one drew <strong>900+ participants</strong> from 50+ colleges with $50K+ in sponsorships.`
    },
]

export const achievementsBoard = [
    { title: 'Best Intern', detail: 'MathCo · 2025 cohort' },
    { title: 'UK Patent', detail: 'Road Anomaly Detection System' },
    { title: 'Azure Administrator', detail: 'Microsoft Certified Associate' },
    { title: 'ICMLDE 2024', detail: 'Alzheimer’s MRI classification · 96.2%' },
    { title: 'OCIT 2024', detail: 'Retinal disease classification · 93.7% F1' },
    { title: 'CGPA 8.97', detail: 'B.Tech CSE · KIIT' },
]

export const desk = {
    name: 'Gourav’s desk',
    role: 'Recent achievements',
    lines: [
        `<strong>Now:</strong> Product Engineer I at MathCo, building AI decision intelligence and GenAI systems for Coca-Cola and Unilever. Founder & Product Architect of <strong>CodeGang</strong> (codegang.in).`,
        `<strong>2025:</strong> Awarded <strong>Best Intern</strong> of the entire MathCo cohort for a Demand–Supply Planning system for Coca-Cola India, saving an estimated $1.2M+.`,
        `<strong>Research:</strong> UK patent accepted for a Road Anomaly Detection System. Papers published at ICMLDE 2024 and OCIT 2024.`,
        `<strong>Also:</strong> Microsoft Certified Azure Administrator Associate, and a B.Tech in Computer Science from KIIT with a CGPA of 8.97.`,
    ]
}
