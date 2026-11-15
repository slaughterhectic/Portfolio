// Generates the cover cards used by the projects and research areas.
import sharp from 'sharp'
import fs from 'fs'

const esc = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;')

const card = ({ eyebrow, title, subtitle, accent, bullets = null }, width = 960, height = 540) =>
{
    const s = width / 960
    let body = ''

    if(bullets)
    {
        bullets.forEach((bullet, index) =>
        {
            const y = 150 + index * 112
            body += `<rect x="70" y="${y}" width="820" height="88" rx="6" fill="#2f2738"/>`
            body += `<rect x="70" y="${y}" width="10" height="88" fill="${accent}"/>`
            body += `<text x="110" y="${y + 40}" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="34" fill="${accent}">${esc(bullet[0])}</text>`
            body += `<text x="110" y="${y + 72}" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="#e9e3ee">${esc(bullet[1])}</text>`
        })
        body += `<text x="70" y="100" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="40" fill="#ffffff">${esc(title[0] + (title[1] ? ' ' + title[1] : ''))}</text>`
    }
    else
    {
        body += `<text x="70" y="150" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="24" letter-spacing="5" fill="${accent}">${esc(eyebrow.toUpperCase())}</text>`
        title.forEach((line, index) =>
        {
            body += `<text x="66" y="${250 + index * 92}" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="86" fill="#ffffff">${esc(line)}</text>`
        })
        body += `<rect x="70" y="${250 + (title.length - 1) * 92 + 36}" width="150" height="8" fill="${accent}"/>`
        body += `<text x="70" y="${250 + (title.length - 1) * 92 + 96}" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#cfc6d8">${esc(subtitle)}</text>`
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 960 540">
        <defs>
            <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a2331"/><stop offset="1" stop-color="#15101a"/></linearGradient>
            <radialGradient id="glow" cx="0.85" cy="0.15" r="0.7"><stop offset="0" stop-color="${accent}" stop-opacity="0.35"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
        </defs>
        <rect width="960" height="540" fill="url(#bg)"/>
        <rect width="960" height="540" fill="url(#glow)"/>
        <circle cx="850" cy="120" r="170" fill="none" stroke="${accent}" stroke-opacity="0.25" stroke-width="2"/>
        <circle cx="850" cy="120" r="110" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="2"/>
        ${body}
    </svg>`
}

const projects = [
    { key: 'osten-rag', eyebrow: 'Osten Group · Brazil', title: [ 'Multi-tenant', 'RAG chatbot' ], subtitle: 'Enterprise document Q&A across subsidiaries', accent: '#8cff5a',
        bullets: [ [ 'Sub-300ms queries', 'Hybrid semantic + keyword search with re-ranking' ], [ 'Tenant-isolated indices', 'LangChain, OpenAI / Anthropic models, vector databases' ], [ 'RAGAS evaluation', 'Faithfulness, context precision, answer relevancy on Azure' ] ] },
    { key: 'resume-ai', eyebrow: 'GenAI platform', title: [ 'Resume AI' ], subtitle: 'Job tailoring and a real-time AI interviewer', accent: '#ffb646',
        bullets: [ [ 'Real-time AI interviewer', 'Whisper STT, TTS and token-streamed LLM answers' ], [ 'JD-based tailoring', 'ATS score and skill-gap analysis over sentence embeddings' ], [ 'Agentic workflow', 'Tool-calling for questions, scoring and resume rewriting' ] ] },
    { key: 'codegang', eyebrow: 'Founder & Product Architect', title: [ 'CodeGang' ], subtitle: 'Multi-tenant SaaS collaboration platform · codegang.in', accent: '#8cff5a',
        bullets: [ [ '50+ clients and developers', 'Project lifecycle, milestones and automated billing' ], [ '1,000+ concurrent users', 'Event-driven async layer, sub-100ms API responses' ], [ '30+ engagements delivered', 'SaaS, web and GenAI for global clients' ] ] },
    { key: 'embedding-system', eyebrow: 'CodeGang', title: [ 'AI embedding', 'system' ], subtitle: 'Semantic search across client codebases', accent: '#b65fff',
        bullets: [ [ '50+ client codebases', 'RAG pipeline with Sentence-BERT embeddings and Pinecone' ], [ 'Sub-50ms query latency', 'Natural-language project discovery with GPT-4' ], [ '100% adoption in 2 months', 'Automated code documentation for every active client' ] ] },
    { key: 'expense-tracker', eyebrow: 'Supply-chain client', title: [ 'Payment &', 'expense tracker' ], subtitle: 'Bespoke B2B finance platform', accent: '#5390ff',
        bullets: [ [ 'Double-entry ledger', 'Vendor reconciliation and multi-currency support' ], [ 'Automated GST reporting', 'React dashboards with anomaly detection' ], [ 'Secure by design', 'FastAPI, RBAC, audit logs and payment webhooks' ] ] },
    { key: 'verse-ai', eyebrow: 'CodeGang · MooveHub, São Paulo', title: [ 'Verse AI' ], subtitle: 'Enterprise AI assistant, live in production', accent: '#8cff5a',
        bullets: [ [ '7-layer AWS stack', 'CDN, API gateway, auth, orchestrator, retrieval, model gateway, data' ], [ 'Tenant isolation', 'Vector-scoped retrieval, no cross-tenant reads' ], [ 'Model gateway', 'Bedrock and OpenAI with failover and budgets' ] ] },
    { key: 'emedici', eyebrow: 'CodeGang · Adelaide, Australia', title: [ 'eMedici' ], subtitle: 'Medical education platform, live in production', accent: '#5390ff',
        bullets: [ [ 'MedEd platform', 'Built for EMEDICI2 PTY LTD' ], [ 'Live in production', 'Shipped and maintained by CodeGang' ], [ 'Adelaide, Australia', 'One of 22 systems CodeGang runs live' ] ] },
    { key: 'armtech-erp', eyebrow: 'CodeGang · Kolkata, India', title: [ 'ARM Tech ERP' ], subtitle: 'Trade and logistics ERP, live in production', accent: '#ffb646',
        bullets: [ [ 'Trade & logistics ERP', 'Built for ARM Tech' ], [ 'Live in production', 'Shipped and maintained by CodeGang' ], [ 'Kolkata, India', 'One of 22 systems CodeGang runs live' ] ] },
    { key: 'nailhiring', eyebrow: 'CodeGang · USA', title: [ 'NailHiring' ], subtitle: 'AI resume builder, shipped end to end', accent: '#ff5fa2',
        bullets: [ [ 'HR SaaS', 'AI resume builder for the US market' ], [ 'Shipped end to end', 'Designed, built and launched by CodeGang' ], [ 'Live in the US', 'In production today' ] ] },
    { key: 'demand-supply', eyebrow: 'MathCo · Coca-Cola India', title: [ 'Demand–supply', 'planning' ], subtitle: 'The system behind the Best Intern award', accent: '#ff8039',
        bullets: [ [ '$1.2M+ saved', '30% less supply–demand mismatch through optimization' ], [ '2M+ time-series rows', 'XGBoost forecasting at 92% accuracy across 500+ SKUs' ], [ 'Days to 30 minutes', 'React, FastAPI, PostgreSQL and Azure DevOps CI/CD' ] ] },
]

const research = [
    { key: 'road-anomaly', eyebrow: 'UK patent accepted', title: [ 'Road anomaly', 'detection' ], subtitle: 'YOLOv8 on a Raspberry Pi 4 · 94% precision at 30 FPS', accent: '#ffb646' },
    { key: 'alzheimers-mri', eyebrow: 'ICMLDE 2024', title: [ 'Alzheimer’s', 'MRI classifier' ], subtitle: 'Hybrid ResNet50–Transformer · 96.2% on ADNI', accent: '#b65fff' },
    { key: 'retinal-disease', eyebrow: 'OCIT 2024', title: [ 'Retinal disease', 'classifier' ], subtitle: 'Attention-enhanced ResNet50 · 93.7% F1', accent: '#5390ff' },
]

fs.mkdirSync('static/projects/images', { recursive: true })
fs.mkdirSync('static/lab/images', { recursive: true })

for(const project of projects)
{
    await sharp(Buffer.from(card(project))).png().toFile(`static/projects/images/${project.key}-1.png`)
    await sharp(Buffer.from(card({ ...project, bullets: project.bullets }))).png().toFile(`static/projects/images/${project.key}-2.png`)
    await sharp(Buffer.from(card({ ...project, bullets: null }))).png().toFile(`static/projects/images/${project.key}-1.png`)
}

for(const item of research)
{
    await sharp(Buffer.from(card(item))).png().toFile(`static/lab/images/${item.key}.png`)
    await sharp(Buffer.from(card(item))).resize(240, 136).png().toFile(`static/lab/images/${item.key}-mini.png`)
}

console.log('life images written')
