// ================================================
// RULE THE WORLD — Game Database
// js/db.js  (regular script, global gameDB)
// Contains: factions, actions, crises, newsPool
// ================================================
"use strict";

export const gameDB = {

    // --------------------------------------------------
    // FACTIONS — 2029 Macroeconomic Projections
    // GDP growth %, Inflation %, Treasury in $T
    // --------------------------------------------------
    factions: {
        india: {
            name: 'India', topo: 'India', align: 'RISING', tier: 'I',
            startCP: 45, stab: 72, qli: 63, ten: 38,
            gdp: 7.2, inf: 5.1, treasury: 3.8, population: 1450,
            demo: { youth: 78, work: 68, rural: 82, elite: 58 },
            traits: ['Demographic Dividend', 'Strategic Autonomy', 'Digital Public Infrastructure'],
            color: 'border-orange-400', mapColor: '#b45309',
            story: "The year is 2029. India is no longer just rising — it has arrived. As the world's fastest-growing major economy, you're aggressively courted by both Western and Eastern blocs. Your 1.45 billion citizens are your greatest asset, but also your greatest challenge. Rural populations demand welfare. Urban elites demand world-class infrastructure. A booming tech sector could leapfrog decades of development. Walk the tightrope, Leader — or fall."
        },
        usa: {
            name: 'United States', topo: 'United States of America', align: 'LEADER', tier: 'I',
            startCP: 50, stab: 52, qli: 78, ten: 22,
            gdp: 2.3, inf: 3.6, treasury: 24.5, population: 340,
            demo: { youth: 44, work: 48, rural: 58, elite: 52 },
            traits: ['Dollar Hegemony', 'Unmatched Military', 'Deepening Political Polarization'],
            color: 'border-red-500', mapColor: '#b91c1c',
            story: "The year is 2029. The United States commands the most powerful military in history and its dollar underpins global finance. But the empire's foundations are cracking. A $36T national debt, historic partisan deadlock, and eroding allies have left the republic vulnerable. Can you stabilize the homeland while maintaining dominance abroad before a rival fills the vacuum?"
        },
        china: {
            name: 'China', topo: 'China', align: 'RISING', tier: 'I',
            startCP: 52, stab: 83, qli: 64, ten: 33,
            gdp: 4.8, inf: 2.3, treasury: 17.5, population: 1405,
            demo: { youth: 68, work: 82, rural: 68, elite: 88 },
            traits: ['Belt & Road Network', 'AI Supremacy Drive', 'Demographic Time Bomb'],
            color: 'border-amber-500', mapColor: '#d97706',
            story: "The year is 2029. The Belt and Road Initiative now spans six continents. Your AI capabilities rival Silicon Valley. Yet profound headwinds loom: a rapidly aging population, a collapsing property sector, and an increasingly hostile West determined to contain your rise. You must secure Taiwan, dominate emerging markets, and build domestic consumption — all before the window closes."
        },
        russia: {
            name: 'Russia', topo: 'Russia', align: 'RIVAL', tier: 'I',
            startCP: 28, stab: 57, qli: 42, ten: 65,
            gdp: -2.1, inf: 9.8, treasury: 1.2, population: 144,
            demo: { youth: 38, work: 62, rural: 68, elite: 82 },
            traits: ['Second-Strike Nuclear Capability', 'Energy Dependency Leverage', 'Isolated but Armed'],
            color: 'border-slate-400', mapColor: '#475569',
            story: "The year is 2029. Russia is a nuclear-armed pariah, economy bleeding under a thousand sanctions. Your ruble buys less each month and your best engineers have emigrated. Yet you still control the world's largest nuclear arsenal and the most feared intelligence apparatus on Earth. Asymmetric warfare is your doctrine. Fracture the West before your treasury runs dry."
        },
        eu: {
            name: 'European Union', topo: 'France', align: 'ALLY', tier: 'I',
            startCP: 38, stab: 74, qli: 88, ten: 14,
            gdp: 1.2, inf: 3.9, treasury: 15.8, population: 450,
            demo: { youth: 62, work: 68, rural: 48, elite: 58 },
            traits: ['Regulatory Superpower', 'Green Energy Pioneer', 'Internal Cohesion Crisis'],
            color: 'border-yellow-400', mapColor: '#ca8a04',
            story: "The year is 2029. The EU remains history's most successful peace project — but peace is no longer guaranteed. Russian aggression, American withdrawal, and surging nationalism from within are forcing an existential crisis. You must forge a common defence, transition to a green economy, and hold 27 independent states together. Unity is power. Division is extinction."
        },
        brazil: {
            name: 'Brazil', topo: 'Brazil', align: 'RISING', tier: 'II',
            startCP: 32, stab: 52, qli: 58, ten: 18,
            gdp: 3.4, inf: 7.2, treasury: 1.9, population: 216,
            demo: { youth: 73, work: 58, rural: 68, elite: 48 },
            traits: ['Amazon Stewardship', 'Agri-Export Powerhouse', 'Endemic Corruption'],
            color: 'border-green-500', mapColor: '#16a34a',
            story: "The year is 2029. Brazil controls the lungs of the planet and the world's most fertile farmland — but squanders both. Corruption networks siphon billions while 40 million citizens live in poverty. A new generation demands accountability. You must modernize without destroying, globalise without losing sovereignty, and end the violence that costs the economy $180B a year."
        },
        nigeria: {
            name: 'Nigeria', topo: 'Nigeria', align: 'RISING', tier: 'II',
            startCP: 27, stab: 42, qli: 38, ten: 28,
            gdp: 5.1, inf: 13.5, treasury: 0.7, population: 230,
            demo: { youth: 84, work: 52, rural: 63, elite: 42 },
            traits: ['Largest African Economy', 'Youth Bulge Engine', 'Oil Revenue Cliff'],
            color: 'border-teal-400', mapColor: '#0d9488',
            story: "The year is 2029. Nigeria is Africa's most populous nation — and its most chaotic. Oil revenues are in freefall as the world electrifies. The naira has lost 60% of its value. Yet beneath the chaos: 230 million people, an average age of 18, and a Nollywood-fintech-agriculture complex that could rival any in the world. Lead the African century — or watch it led by someone else."
        }
    },

    // --------------------------------------------------
    // POLICY ACTIONS
    // --------------------------------------------------
    actions: [
        // --- INDIA UNIQUE ---
        {
            id: 'ind1', cat: 'ECON', faction: 'india', name: 'PLI Manufacturing Scheme', cost: 35, money: 0.2,
            desc: 'Subsidize domestic manufacturing with Production-Linked Incentives, creating millions of working-class jobs.',
            effect: () => { s.c.gdp += 2.8; s.c.demo.work += 10; s.c.demo.elite += 5; s.prestige += 20; }
        },
        {
            id: 'ind2', cat: 'MIL', faction: 'india', name: 'Agnipath Border Infra', cost: 32, money: 0.12,
            desc: 'Short-term military conscription + border infrastructure upgrade to project strategic depth.',
            effect: () => { updateTension(6); s.c.demo.youth += 12; s.c.stab += 8; }
        },
        {
            id: 'ind3', cat: 'DIP', faction: 'india', name: 'Global South Summit', cost: 25, money: 0.05,
            desc: 'Position India as the voice of the global south, lowering tension and opening new markets.',
            effect: () => { updateTension(-12); s.c.gdp += 0.8; Object.keys(s.diplomaticRelations).forEach(k => { if (gameDB.factions[k]?.align === 'ALLY') s.diplomaticRelations[k] = Math.min(100, (s.diplomaticRelations[k] || 50) + 8); }) }
        },
        {
            id: 'ind4', cat: 'DOM', faction: 'india', name: 'Digital Public Infra Export', cost: 20, money: -0.15,
            desc: 'Export UPI-style digital payment infrastructure globally, earning licensing revenue and diplomatic capital.',
            effect: () => { s.c.qli += 10; s.c.treasury += 0.25; s.c.demo.elite += 10; s.c.techLevel += 0.05; }
        },

        // --- USA UNIQUE ---
        {
            id: 'usa1', cat: 'MIL', faction: 'usa', name: 'Carrier Strike Group Deploy', cost: 40, money: 0.3,
            desc: 'Forward-deploy a full carrier battle group to a contested region. Projects unmatchable hard power.',
            effect: () => { updateTension(12); s.c.demo.elite += 15; s.c.demo.youth += 5; s.prestige += 30; }
        },
        {
            id: 'usa2', cat: 'ECON', faction: 'usa', name: 'Petrodollar Enforcement', cost: 30, money: -0.2,
            desc: 'Pressure OPEC nations to maintain dollar-denominated oil settlements, propping up dollar dominance.',
            effect: () => { s.c.gdp += 1.5; s.c.treasury += 0.5; updateTension(8); }
        },
        {
            id: 'usa3', cat: 'DIP', faction: 'usa', name: 'NATO Article 5 Invocation', cost: 35, money: 0.15,
            desc: 'Formally invoke collective defence obligations. Allies must contribute. Raises tension with rivals significantly.',
            effect: () => { updateTension(20); s.c.demo.elite += 20; Object.keys(s.diplomaticRelations).forEach(k => { if (gameDB.factions[k]?.align === 'ALLY') s.diplomaticRelations[k] = Math.min(100, (s.diplomaticRelations[k] || 50) + 15); }) }
        },

        // --- CHINA UNIQUE ---
        {
            id: 'chn1', cat: 'ECON', faction: 'china', name: 'Belt & Road Extension', cost: 45, money: 0.4,
            desc: 'Finance a new BRI corridor, locking developing nations into Chinese infrastructure dependency.',
            effect: () => { s.c.gdp += 2.5; s.occupiedTerritories.length >= 1 && (s.c.treasury += 0.3); updateTension(5); }
        },
        {
            id: 'chn2', cat: 'MIL', faction: 'china', name: 'South China Sea Militarisation', cost: 35, money: 0.2,
            desc: 'Fortify artificial islands and establish an ADIZ. Controls critical shipping lanes.',
            effect: () => { updateTension(18); s.c.demo.elite += 20; s.c.demo.youth += 10; s.prestige += 25; }
        },

        // --- GENERAL ACTIONS ---
        {
            id: 'd1', cat: 'DOM', name: 'Agrarian Subsidy Package', cost: 25, money: 0.22,
            desc: 'Subsidize fertilizers, seeds and crop prices. Boom for rural heartlands, costly for elites.',
            effect: () => { s.c.demo.rural += 18; s.c.demo.elite -= 8; s.c.inf += 0.8; }
        },
        {
            id: 'd2', cat: 'DOM', name: 'Student Debt Jubilee', cost: 32, money: 0.35,
            desc: 'Cancel student loan obligations. Youth will love it; fiscal conservatives will howl.',
            effect: () => { s.c.demo.youth += 22; s.c.demo.elite -= 15; }
        },
        {
            id: 'e1', cat: 'ECON', name: 'Corporate Tax Holiday', cost: 28, money: 0.4,
            desc: 'Slash corporate tax rates to attract FDI. Working class bears the welfare burden.',
            effect: () => { s.c.demo.elite += 22; s.c.demo.work -= 14; s.c.gdp += 2.2; }
        },
        {
            id: 'e2', cat: 'ECON', name: 'Central Bank Rate Hike', cost: 22, money: 0,
            desc: 'Order emergency rate hikes. Inflation cools, but growth craters and mortgages spike.',
            effect: () => { s.c.inf = Math.max(0, s.c.inf - 3.5); s.c.demo.elite += 8; s.c.demo.work -= 12; s.c.demo.rural -= 12; s.c.gdp -= 2.5; }
        },
        {
            id: 'm1', cat: 'MIL', name: 'Cyberwarfare Campaign', cost: 32, money: 0.08,
            desc: 'Authorize covert cyber ops against rival digital infrastructure. Plausibly deniable.',
            effect: () => { updateTension(6); s.c.inf -= 0.4; s.c.techLevel += 0.03; }
        },
        {
            id: 'p1', cat: 'DIP', name: 'Aggressive Trade Tariffs', cost: 22, money: 0,
            desc: 'Punitive tariffs on rival imports. Workers protected, but retaliation likely.',
            effect: () => { updateTension(10); s.c.demo.work += 12; s.c.gdp += 0.8; }
        },
        {
            id: 'dom1', cat: 'DOM', name: 'Universal Healthcare Act', cost: 42, money: 0.45,
            desc: 'Establish single-payer universal healthcare. Transformative for workers and rural — elites face higher taxes.',
            effect: () => { s.c.demo.work += 22; s.c.demo.rural += 16; s.c.demo.elite -= 12; s.c.qli += 10; }
        },
        {
            id: 'dom2', cat: 'DOM', name: 'National Infrastructure Blitz', cost: 38, money: 0.5,
            desc: 'Trillion-dollar construction: high-speed rail, highways, fibre. GDP multiplier effect.',
            effect: () => { s.c.gdp += 2.8; s.c.demo.rural += 12; s.c.demo.work += 10; s.c.techLevel += 0.04; }
        },
        {
            id: 'dom3', cat: 'DOM', name: 'State Media Consolidation', cost: 18, money: 0.12,
            desc: 'Centralise narrative control via state broadcasters. Unevenly popular, internationally condemned.',
            effect: () => { s.c.demo.youth += 6; s.c.demo.work += 6; s.c.demo.rural += 8; updateTension(4); }
        },
        {
            id: 'eco3', cat: 'ECON', name: 'Green Industrial Deal', cost: 38, money: 0.35,
            desc: 'Massive green energy, EV and carbon-credit investment. Youth mobilised; fossil fuel lobby furious.',
            effect: () => { s.c.demo.youth += 22; s.c.demo.elite -= 10; s.c.gdp += 1.2; s.c.techLevel += 0.07; s.prestige += 15; }
        },
        {
            id: 'eco4', cat: 'ECON', name: 'Free Trade Zone', cost: 28, money: 0,
            desc: 'Abolish import barriers with strategic partners. Cheap goods flood market; domestic jobs at risk.',
            effect: () => { s.c.gdp += 2.2; s.c.inf -= 0.8; s.c.demo.work -= 10; updateTension(-6); }
        },
        {
            id: 'dip2', cat: 'DIP', name: 'Intelligence Sharing Pact', cost: 18, money: 0,
            desc: 'Share classified signals intelligence with allied nations, tightening the coalition.',
            effect: () => { updateTension(-12); s.c.demo.elite += 6; Object.keys(s.diplomaticRelations).forEach(k => { if (gameDB.factions[k] && gameDB.factions[k].align !== 'RIVAL') s.diplomaticRelations[k] = Math.min(100, (s.diplomaticRelations[k] || 50) + 12); }); }
        },
        {
            id: 'mil2', cat: 'MIL', name: 'Targeted Economic Sanctions', cost: 28, money: 0,
            desc: 'Impose sector-specific sanctions on a rival nation. Diplomatic pressure without kinetic escalation.',
            effect: () => { updateTension(12); s.c.demo.elite += 10; if (s.selectedForeignCountry) { const tid = Object.keys(gameDB.factions).find(id => gameDB.factions[id].topo === s.selectedForeignCountry); if (tid) gameDB.factions[tid].gdp -= 2.5; } }
        },
        {
            id: 'dom4', cat: 'DOM', name: 'Anti-Corruption Tribunal', cost: 30, money: -0.1,
            desc: 'Establish an independent anti-corruption body. Elites threatened; youth and workers mobilised.',
            effect: () => { s.c.demo.youth += 18; s.c.demo.work += 10; s.c.demo.elite -= 20; s.c.stab += 12; }
        },
        {
            id: 'mil3', cat: 'MIL', name: 'Hypersonic Missile Program', cost: 50, money: 0.4,
            desc: 'Develop and test a domestic hypersonic strike capability. Strategic deterrence at a steep price.',
            effect: () => { updateTension(15); s.c.techLevel += 0.12; s.c.demo.elite += 20; s.prestige += 40; }
        }
    ],

    // --------------------------------------------------
    // SYSTEM CRISES
    // --------------------------------------------------
    systemCrises: [
        {
            id: 'c1', name: "Global Supply Chain Collapse", symbol: '🚢',
            desc: "Critical shipping lanes blockaded. Global freight paralysed. Consumer prices skyrocketing.",
            gdpDrain: 0.6, infSpike: 0.4, costCP: 55, costMoney: 0.6
        },
        {
            id: 'c2', name: "Pandemic Outbreak (Novel Pathogen)", symbol: '🦠',
            desc: "A highly transmissible pathogen has breached borders. ICUs overrun. Working class hardest hit.",
            gdpDrain: 1.2, appDrain: 1.2, costCP: 85, costMoney: 1.2
        },
        {
            id: 'c3', name: "Catastrophic Drought", symbol: '🌵',
            desc: "Multi-year droughts devastate farmland. Food insecurity spreading. Grain prices up 80%.",
            gdpDrain: 0.3, infSpike: 0.7, costCP: 65, costMoney: 0.4
        },
        {
            id: 'c4', name: "Financial Market Crash", symbol: '📉',
            desc: "Black swan event: markets down 42% in 72 hours. Margin calls cascade. Capital flight accelerates.",
            gdpDrain: 1.8, infSpike: 1.0, costCP: 75, costMoney: 2.0
        },
        {
            id: 'c5', name: "Power Grid Sabotage", symbol: '⚡',
            desc: "Coordinated attacks on electrical infrastructure. Rolling blackouts cripple industry and hospitals.",
            gdpDrain: 0.9, appDrain: 0.6, costCP: 48, costMoney: 0.7
        },
        {
            id: 'c6', name: "Diplomatic Hostage Crisis", symbol: '🚨',
            desc: "Fourteen ambassadors seized by a rogue state. The global community watches. Every hour costs prestige.",
            appDrain: 1.8, costCP: 65, costMoney: 0.5
        },
        {
            id: 'c7', name: "Famine Declaration", symbol: '🌾',
            desc: "UN declares emergency famine conditions. Rural approval in freefall. World Food Programme demands access.",
            gdpDrain: 0.5, infSpike: 1.2, appDrain: 1.2, costCP: 58, costMoney: 0.8
        },
        {
            id: 'c8', name: "Refugee Crisis Wave", symbol: '🏕',
            desc: "Five million displaced persons flood borders following regional conflict. Strain on infrastructure is immense.",
            gdpDrain: 0.4, appDrain: 0.8, costCP: 60, costMoney: 0.9
        },
        {
            id: 'c9', name: "Cyber Sovereignty Breach", symbol: '💻',
            desc: "State secrets leaked by an enemy intelligence service. Public trust in government at historic low.",
            appDrain: 2.0, costCP: 45, costMoney: 0.3
        }
    ],

    // --------------------------------------------------
    // NEWS POOL (30+ contextual headlines)
    // --------------------------------------------------
    newsPool: [
        "Panic selling grips stock markets as credit crunch rumours spread.",
        "Hundreds of thousands march in the capital demanding higher wages.",
        "Domestic tech giants post record profits — wealth gap widens.",
        "Unseasonal droughts severely damage this quarter's crop yield.",
        "Deadly border skirmishes reported in contested territories.",
        "Central bank governors hold emergency summit to address currency slide.",
        "AI-driven automation triggers mass layoffs in manufacturing sector.",
        "Health officials detect new viral variant spreading in urban centres.",
        "Leaked diplomatic cables expose covert operations — major embarrassment.",
        "Rare earth shortage threatens to halt advanced electronics production.",
        "Satellite imagery confirms massive military buildup along disputed border.",
        "Opposition launches scathing parliamentary inquiry into corruption.",
        "New data: middle-class wealth shrinking for fifth consecutive quarter.",
        "Foreign capital flight crashes local currency by 9% overnight.",
        "Scientists warn of irreversible climate tipping points — emergency session called.",
        "State intelligence suffers massive classified document breach.",
        "Riots erupt in three major cities over fuel costs and unemployment.",
        "Regional powers sign mutual defence pact, excluding our nation.",
        "Central bank prints emergency currency — hyperinflation risk flares.",
        "Youth voter registration hits record high — political realignment looming.",
        "Inequality index hits all-time high — civil unrest spreading.",
        "Oligarchs fund separatist militias in remote northern provinces.",
        "Infrastructure investment surge announced — tens of thousands of jobs created.",
        "Domestic scientist wins Nobel Prize — national pride at peak.",
        "Black market economy surges as formal unemployment exceeds 18%.",
        "Drone strikes hit contested border posts — escalation feared.",
        "World Bank downgrades sovereign credit rating to junk status.",
        "Massive offshore oil reserve discovered — markets react positively.",
        "Youth unemployment crisis: a lost generation speaks out.",
        "State-owned enterprise collapses — pension funds at risk.",
        "Ceasefire holds tenuously — UN peacekeepers deployed.",
        "New trade corridor inaugurated — diplomatic breakthrough celebrated.",
        "Mass protests at presidential palace — security forces respond with water cannon.",
        "Export controls imposed on strategic minerals — supply chain tremors felt globally."
    ]
};
