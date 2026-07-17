import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// Pre-packaged mock data for investigation nodes
const MOCK_DATA = {
  "Rashmika Mandanna Vijay Deverakonda wedding": {
    summary: "Rashmika Mandanna and Vijay Deverakonda were officially married on February 26, 2026. The wedding ceremonies took place at the ITC Grand Bharat in Udaipur, Rajasthan. The couple, affectionately referred to as 'Virosh', honored their cultural roots by holding two separate ceremonies: a traditional Telugu wedding in the morning and a Kodava ritual in the evening. A grand wedding reception was later held in Hyderabad on March 4, 2026, attended by numerous celebrities.",
    limeText: "Rashmika Mandanna and Vijay Deverakonda were officially married in Udaipur. Traditional ceremonies included Telugu and Kodava rituals, followed by a Hyderabad reception.",
    limeHighlights: ["Rashmika", "Vijay", "married", "wedding", "Udaipur", "Telugu", "Kodava", "reception"],
    limeConclusion: "Conclusion: Localized term weighting shows high correlation between Rashmika, Vijay, and wedding occurrences in early 2026.",
    shapConclusion: "Conclusion: Highly verified celebrity news portals corroborate the wedding events with 99% confidence.",
    evidence: [
      { id: 'ev-0', label: 'India Today', title: 'Rashmika-Vijay Udaipur Wedding Live Updates', shap: 45, snippet: "Rashmika Mandanna and Vijay Deverakonda Udaipur wedding live updates: Ceremony ceremonies took place at the ITC Grand Bharat.", url: "https://www.indiatoday.in" },
      { id: 'ev-1', label: 'NDTV', title: 'Rashmika Mandanna And Vijay Deverakonda Are Now Married', shap: 35, snippet: "Actress Rashmika Mandanna and actor Vijay Deverakonda officially tied the knot in traditional ceremonies.", url: "https://www.ndtv.com" },
      { id: 'ev-2', label: 'Hindustan Times', title: 'Rashmika Mandanna, Vijay Deverakonda wedding reception', shap: 20, snippet: "A grand wedding reception was held in Hyderabad on March 4, 2026 for Rashmika and Vijay.", url: "https://www.hindustantimes.com" }
    ],
    contextual: [
      { id: 'ctx-0', label: 'Entity', title: 'ITC Grand Bharat Udaipur' },
      { id: 'ctx-1', label: 'Entity', title: 'Virosh Hyderabad Reception' },
      { id: 'ctx-2', label: 'Topic', title: 'Traditional Telugu and Kodava ceremonies' }
    ]
  },
  "VIT Chennai recent news events 2026": {
    summary: "VIT Chennai is preparing to co-host Tamil Nadu's First International AI Conference, the 'Chennai AI Summit 2026,' on August 7 and 8, 2026. Organized alongside the World Tamil Chamber of Commerce, the summit will focus on themes including Cybersecurity AI, Semiconductor AI, Quantum AI, and Healthcare AI. Earlier in the year, the university also hosted an event titled 'Biotechnology: Role in Industry 5.0-Sustainable Future Pathways' on February 7, 2026.",
    limeText: "VIT Chennai hosts the Chennai AI Summit 2026 in August, and hosted Biotechnology in Industry 5.0 in February.",
    limeHighlights: ["VIT", "Chennai", "AI", "Summit", "2026", "Biotechnology", "Industry"],
    limeConclusion: "Conclusion: Term analysis highlights VIT Chennai as a major hub for AI and Biotechnology events in 2026.",
    shapConclusion: "Conclusion: Official university circulars and news items confirm both summits with 97% confidence.",
    evidence: [
      { id: 'ev-0', label: 'VIT Events', title: 'Chennai AI Summit 2026 - VIT', shap: 55, snippet: "VIT Chennai is co-hosting the Chennai AI Summit 2026 on August 7 and 8, focusing on Cybersecurity AI, Semiconductor AI, and Quantum AI.", url: "https://chennai.vit.ac.in" },
      { id: 'ev-1', label: 'QUICK 2026', title: 'Biotechnology: Role in Industry 5.0', shap: 30, snippet: "On February 7, 2026, VIT Chennai hosted Biotechnology: Role in Industry 5.0-Sustainable Future Pathways.", url: "https://chennai.vit.ac.in" }
    ],
    contextual: [
      { id: 'ctx-0', label: 'Entity', title: 'Chennai AI Summit 2026' },
      { id: 'ctx-1', label: 'Entity', title: 'Industry 5.0 Sustainable Pathways' },
      { id: 'ctx-2', label: 'Topic', title: 'World Tamil Chamber of Commerce' }
    ]
  },
  "NASA current mission news 2026": {
    summary: "In July 2026, NASA announced significant investments in its lunar exploration efforts. The agency selected 41 technology proposals from 37 American companies to help develop capabilities for future Moon and Mars missions, focusing on areas like space transportation and planetary surface operations. Additionally, NASA awarded nearly $600 million to three commercial space companies—Astrobotic, Firefly Aerospace, and Intuitive Machines—to carry out four new Moon missions in late 2028, aiming to deliver scientific instruments to the lunar surface.",
    limeText: "NASA selected 41 space technologies for Moon and Mars exploration and announced four new commercial Moon missions.",
    limeHighlights: ["NASA", "Moon", "Mars", "exploration", "missions", "lunar", "technologies"],
    limeConclusion: "Conclusion: Term search shows high correlation between NASA, Moon missions, and commercial aerospace contracts in 2026.",
    shapConclusion: "Conclusion: ScienceDaily and official NASA announcements verify the lunar development contracts with 98% confidence.",
    evidence: [
      { id: 'ev-0', label: 'ScienceDaily', title: 'NASA selects 41 space technologies for future Moon and Mars exploration', shap: 48, snippet: "NASA announced 41 technology proposals to help develop capabilities for future lunar and Mars exploration.", url: "https://www.sciencedaily.com" },
      { id: 'ev-1', label: 'ScienceDaily', title: 'NASA selects four new Moon missions to build a permanent lunar base', shap: 42, snippet: "NASA selected four new Moon missions, awarding nearly $600M to Astrobotic, Firefly Aerospace, and Intuitive Machines.", url: "https://www.sciencedaily.com" }
    ],
    contextual: [
      { id: 'ctx-0', label: 'Entity', title: 'Astrobotic Firefly Intuitive Machines' },
      { id: 'ctx-1', label: 'Entity', title: 'Moon and Mars exploration technologies' },
      { id: 'ctx-2', label: 'Topic', title: 'Commercial Lunar Payload Services' }
    ]
  },
  "Art history news exhibitions 2026": {
    summary: "The year 2026 features major art historical exhibitions globally. The Museum of Modern Art (MoMA) in New York opened a massive Marcel Duchamp retrospective on April 16, 2026, featuring approximately 300 works. In Europe, the 61st Venice Biennale runs from May 9 to November 22, 2026, featuring the main exhibition 'In Minor Keys' curated by the late Koyo Kouoh. Furthermore, Marina Abramović has become the first living female artist to have a major solo show at the Gallerie dell'Accademia in Venice, which opened in May 2026.",
    limeText: "Major exhibitions in 2026 include a Marcel Duchamp retrospective at MoMA, the 61st Venice Biennale, and Marina Abramović at the Gallerie dell'Accademia.",
    limeHighlights: ["exhibitions", "Art", "history", "Venice", "Biennale", "Duchamp", "MoMA", "Abramović"],
    limeConclusion: "Conclusion: Exhibition schedules show high density of major historical retrospectives throughout 2026.",
    shapConclusion: "Conclusion: Global museum announcements and Biennale guides verify these art exhibitions with 96% confidence.",
    evidence: [
      { id: 'ev-0', label: 'MoMAA Research', title: "The Art Collector's Calendar 2026", shap: 50, snippet: "MoMA is hosting a retrospective for Marcel Duchamp containing 300 works, and Marina Abramović has a major solo show in Venice.", url: "https://momaa.org" },
      { id: 'ev-1', label: 'Culture Tourist', title: 'Best Art Exhibitions in European Museums in 2026', shap: 40, snippet: "The 61st Venice Biennale presents 'In Minor Keys', running from May to November 2026.", url: "https://culturetourist.com" }
    ],
    contextual: [
      { id: 'ctx-0', label: 'Entity', title: 'Marcel Duchamp MoMA Retrospective' },
      { id: 'ctx-1', label: 'Entity', title: '61st Venice Biennale' },
      { id: 'ctx-2', label: 'Entity', title: 'Marina Abramović solo show' }
    ]
  }
};

function App() {
  const [query, setQuery] = useState("Rashmika Mandanna Vijay Deverakonda wedding");
  const [activeTab, setActiveTab] = useState("shap"); // "shap" or "lime"
  const [decryptText, setDecryptText] = useState("");
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [activeSidePanelNode, setActiveSidePanelNode] = useState(null);
  const [isCerebrasLoading, setIsCerebrasLoading] = useState(false);

  const [currentData, setCurrentData] = useState({
    summary: "",
    limeText: "",
    limeHighlights: [],
    limeConclusion: "",
    shapConclusion: "",
    evidence: [],
    contextual: []
  });

  // Graph Nodes State
  const [nodes, setNodes] = useState([]);
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const boardRef = useRef(null);

  // Helper to dynamically get data for any query (fallback if no Groq Key is configured)
  const getData = (q) => {
    if (MOCK_DATA[q]) return MOCK_DATA[q];
    
    const cleanQ = q.trim();
    if (!cleanQ) {
      return {
        summary: "",
        limeText: "",
        limeHighlights: [],
        limeConclusion: "",
        shapConclusion: "",
        evidence: [],
        contextual: []
      };
    }
    
    const stopWords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "with", "by", "about", "against", "of", "is", "was", "were", "are", "won", "lost", "has", "have", "had", "who", "which", "that"]);
    const words = cleanQ.split(/\s+/).map(w => w.replace(/[^\w]/g, "")).filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));
    
    const limeHighlights = words.length > 0 ? words : [cleanQ];
    
    const summary = `System analyzed intelligence reports and public records regarding "${cleanQ}". The verified evidence corroborates that the events, individuals, and activities associated with this target query have a high level of factual alignment and statistical confidence across primary global data sources.`;
    
    const limeText = `The system detected that the key elements, specifically ${limeHighlights.join(", ")}, show significant local features and occurrences within public records and digital intelligence archives, leading to a high corroboration index for this target query.`;
    
    const domains = [
      { label: "wikipedia.org", suffix: "Overview" },
      { label: "reuters.com", suffix: "Special Report" },
      { label: "apnews.com", suffix: "Press Release" },
      { label: "nytimes.com", suffix: "Analysis & Context" }
    ];
    
    const evidence = domains.map((dom, idx) => {
      const shap = idx === 3 ? -15 : Math.floor(20 + (idx * 15) + (cleanQ.length % 7));
      return {
        id: `ev-${idx}`,
        label: dom.label,
        title: `${cleanQ} - ${dom.suffix}`,
        shap: shap,
        snippet: `Detailed coverage indicates that "${cleanQ}" represents a critical event or record. The published documentation at ${dom.label} confirms various components matching this target query with high correlation.`,
        url: `https://www.${dom.label}`
      };
    });
    
    const contextual = [
      { id: "ctx-0", label: "Entity", title: `${limeHighlights[0] || "Target"} Historical Context` },
      { id: "ctx-1", label: "Topic", title: `Global records of ${limeHighlights[1] || "Query"}` },
      { id: "ctx-2", label: "Related", title: `${cleanQ} Verification` },
      { id: "ctx-3", label: "Timeline", title: `${cleanQ} chronological events` }
    ];
    
    const limeConclusion = `Conclusion: The contextual proximity of words like ${limeHighlights.slice(0, 3).map(w => `'${w}'`).join(", ")} within highly-rated domains confirms the target query.`;
    
    const shapConclusion = `Conclusion: Multiple independent global authorities heavily corroborated the target query, resulting in a ${(85 + (cleanQ.length % 14))}% confidence score.`;
    
    return {
      summary,
      limeText,
      limeHighlights,
      limeConclusion,
      shapConclusion,
      evidence,
      contextual
    };
  };

  // Initialize board nodes based on active query
  useEffect(() => {
    const cleanQ = query.trim();
    if (!cleanQ) {
      setNodes([]);
      setDecryptText("Waiting for target input...");
      setIsDecrypting(false);
      setCurrentData({
        summary: "",
        limeText: "",
        limeHighlights: [],
        limeConclusion: "",
        shapConclusion: "",
        evidence: [],
        contextual: []
      });
      return;
    }

    let isMounted = true;
    let decryptionInterval = null;

    async function loadData() {
      let data;
      if (MOCK_DATA[query]) {
        data = MOCK_DATA[query];
      } else {
        setIsCerebrasLoading(true);
        setDecryptText("Querying Cerebras AI node for live intelligence...");
        try {
          const models = ["gemma-4-31b", "zai-glm-4.7", "gpt-oss-120b"];
          let response = null;
          let responseError = null;

          for (const model of models) {
            try {
              response = await fetch("/api/cerebras", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  model: model,
                  response_format: { type: "json_object" },
                  messages: [
                    {
                      role: "system",
                      content: "You are an advanced OSINT and Explainability AI. For the given target query, retrieve and simulate actual, verified news reports, source articles, and geographic/entity details from your knowledge base. Under 'evidence', return 3-5 real news publications (e.g., bbc.com, thehindu.com, ndtv.com, indianexpress.com, reuters.com) that covered the event, with accurate titles, snippets containing actual facts/quotes, and plausible URLs. Under 'contextual', list relevant entities, figures, or topics connected to the event. Return a JSON object matching this structure: { summary: string, limeText: string, limeHighlights: string[], limeConclusion: string, shapConclusion: string, evidence: [{ id: string, label: string, title: string, shap: number, snippet: string, url: string }], contextual: [{ id: string, label: string, title: string }] }. Ensure shap values are integers between -100 and 100. Ensure limeHighlights contain exact words that are present in the summary and limeText. Return ONLY the JSON object. Do not include any explanation outside the JSON."
                    },
                    {
                      role: "user",
                      content: `Analyze the target query: "${query}"`
                    }
                  ]
                })
              });
              if (response.ok) {
                responseError = null;
                break;
              } else {
                const errText = await response.text();
                console.error(`Model ${model} failed with status ${response.status}:`, errText);
                responseError = new Error(`Status ${response.status} - ${errText}`);
              }
            } catch (e) {
              console.error(`Fetch error for model ${model}:`, e);
              responseError = e;
            }
          }

          if (responseError || !response || !response.ok) {
            throw responseError || new Error("All Cerebras models failed to query.");
          }

          const resJson = await response.json();
          let rawContent = resJson.choices[0].message.content.trim();
          
          // Sanitize rawContent to remove any markdown code block wrappers
          if (rawContent.startsWith("```")) {
            rawContent = rawContent.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
          }
          
          data = JSON.parse(rawContent);
        } catch (err) {
          console.error("Cerebras API query failed. Real HTTP status/error details:", err.message || err);
          // Fallback to local dynamic generator
          data = getData(query);
          data.summary = `[CEREBRAS API ERROR - FALLBACK INTEL] ${data.summary}`;
        } finally {
          if (isMounted) setIsCerebrasLoading(false);
        }
      }

      if (!isMounted) return;

      setCurrentData(data);

      // Trigger Decrypting Text Animation
      setIsDecrypting(true);
      let count = 0;
      const finalMsg = data.summary || "No intelligence found.";
      const chars = "XYZ019#@$!%&?*[]{}";
      
      decryptionInterval = setInterval(() => {
        let scramble = "";
        for (let i = 0; i < finalMsg.length; i++) {
          if (i < count) {
            scramble += finalMsg[i];
          } else if (i < count + 5) {
            scramble += chars[Math.floor(Math.random() * chars.length)];
          }
        }
        setDecryptText(scramble);
        count += 5;
        
        if (count >= finalMsg.length + 5) {
          clearInterval(decryptionInterval);
          setDecryptText(finalMsg);
          setIsDecrypting(false);
        }
      }, 20);

      // Setup coordinates for nodes dynamically
      const canvasWidth = 960;
      const canvasHeight = 440;
      const center = { x: canvasWidth / 2, y: canvasHeight / 2 };
      
      const calculatedNodes = [
        { id: 'query', type: 'query', label: 'Target Query', title: query, x: center.x, y: center.y }
      ];

      // Orbiting Evidence nodes
      const evCount = data.evidence.length;
      data.evidence.forEach((ev, i) => {
        const angle = (i * 2 * Math.PI) / evCount - Math.PI / 2;
        calculatedNodes.push({
          ...ev,
          type: 'evidence',
          x: center.x + 200 * Math.cos(angle),
          y: center.y + 140 * Math.sin(angle)
        });
      });

      // Orbiting Contextual nodes
      const ctxCount = data.contextual.length;
      data.contextual.forEach((ctx, i) => {
        const angle = (i * 2 * Math.PI) / ctxCount + Math.PI / 4;
        calculatedNodes.push({
          ...ctx,
          type: 'context',
          x: center.x + 360 * Math.cos(angle),
          y: center.y + 190 * Math.sin(angle)
        });
      });

      setNodes(calculatedNodes);
    }

    loadData();

    return () => {
      isMounted = false;
      if (decryptionInterval) clearInterval(decryptionInterval);
    };
  }, [query]);

  // Drag and Drop handlers
  const handleMouseDown = (e, nodeId) => {
    e.stopPropagation();
    setDraggingNodeId(nodeId);
    const node = nodes.find(n => n.id === nodeId);
    if (node && boardRef.current) {
      const rect = boardRef.current.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      setDragOffset({
        x: clientX - node.x,
        y: clientY - node.y
      });
    }
  };

  const handleMouseMove = (e) => {
    if (!draggingNodeId || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    
    setNodes(prev => prev.map(node => {
      if (node.id === draggingNodeId) {
        return {
          ...node,
          x: Math.max(50, Math.min(rect.width - 50, clientX - dragOffset.x)),
          y: Math.max(40, Math.min(rect.height - 40, clientY - dragOffset.y))
        };
      }
      return node;
    }));
  };

  const handleMouseUp = () => {
    setDraggingNodeId(null);
  };

  // Node Clicking (Opens LIME Side-panel)
  const handleNodeClick = (node) => {
    if (node.type === 'evidence') {
      setActiveSidePanelNode(node);
    }
  };

  // Double click Contextual Node triggers new query
  const handleContextDoubleClick = (node) => {
    setQuery(node.title);
  };



  // Helper to render LIME highlights
  const renderLimeHighlights = (text, highlights) => {
    if (!highlights || highlights.length === 0) return text;
    
    // Sort highlights by length descending to prevent substring issues
    const sorted = [...highlights].sort((a, b) => b.length - a.length);
    let html = text;
    
    sorted.forEach(word => {
      const regex = new RegExp(`\\b(${word})\\b`, 'gi');
      html = html.replace(regex, `<span class="px-1.5 py-0.5 rounded font-bold bg-violet text-[#F8FAFC] shadow-[0_0_8px_#8B5CF6] border border-violet/30">$1</span>`);
    });

    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div className="min-h-screen bg-navy-900 text-[#F8FAFC] p-6 relative overflow-hidden select-none">
      
      {/* Decorative Cyan and Violet Ambient Glows */}
      <div className="absolute top-[-100px] left-[20%] w-[500px] h-[500px] rounded-full bg-violet/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[20%] w-[500px] h-[500px] rounded-full bg-cyan/10 blur-[120px] pointer-events-none" />

      {/* Cyber control board header */}
      <header className="flex justify-between items-center border-b border-navy-800 pb-4 mb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">SHERLOCK AI</h1>
          <p className="text-[#00D4FF] text-xs font-extrabold uppercase tracking-[0.25em] mt-1">Autonomous OSINT & Explainability Dashboard</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-cyan animate-pulse" />
            <span className="border border-violet/50 text-violet px-3 py-1 text-xs font-black uppercase rounded tracking-wider bg-violet/10">
              SYSTEM ONLINE
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto flex flex-col gap-6">
        
        {/* Top search bar & Terminal */}
        <section className="bg-navy-800 border border-navy-800 rounded-lg p-5 shadow-2xl flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-cyan" />
            <h2 className="text-xs font-black uppercase tracking-wider text-[#94A3B8]">Investigation Target</h2>
          </div>
          
          <div className="flex gap-4">
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter investigation target (e.g. Rashmika Mandanna Vijay Deverakonda wedding)"
              className="flex-1 bg-navy-950 border border-navy-800 rounded-md px-4 py-3 text-white font-bold placeholder-navy-800 focus:outline-none focus:border-cyan focus:shadow-[0_0_15px_rgba(0,212,255,0.2)] transition-cyber text-base"
            />
            <button 
              onClick={() => {
                // Force a query refresh by setting the value
                setQuery(query);
              }}
              className="bg-navy-800 text-cyan border border-cyan rounded-md px-6 font-black uppercase tracking-wider hover:bg-cyan hover:text-navy-900 hover:shadow-[0_0_20px_#00D4FF] transition-cyber text-sm min-w-[160px]"
            >
              Analyze
            </button>
          </div>

          <div className="bg-navy-950 border border-navy-800 rounded p-4 font-mono text-sm min-h-[90px] flex flex-col gap-2 relative">
            <div className="text-xs font-bold text-cyan tracking-wider flex justify-between">
              <span>[TERMINAL DECRYPT INTEL]</span>
              {isCerebrasLoading && <span className="animate-pulse text-warning font-black">🤖 LIVE QUERYING CEREBRAS...</span>}
            </div>
            <p className={`font-bold leading-relaxed text-sm ${isDecrypting ? 'text-cyan font-mono' : 'text-[#F8FAFC] font-sans'}`}>
              {decryptText}
            </p>
          </div>
        </section>

        {/* Node board canvas */}
        <section className="relative">
          <h2 className="text-sm font-black uppercase tracking-wider text-[#94A3B8] mb-3 flex items-center gap-2">
            <span className="w-1.5 h-3 bg-cyan" />
            Interactive Investigation Map
          </h2>
          
          <div 
            ref={boardRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="w-full h-[440px] bg-navy-950 border-2 border-navy-800 rounded-lg relative overflow-hidden shadow-2xl cursor-default"
            style={{
              backgroundImage: 'linear-gradient(rgba(51, 65, 85, 0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(51, 65, 85, 0.12) 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }}
          >
            {/* SVG Connections Canvas */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {nodes.map((node) => {
                if (node.id === 'query') return null;
                
                // Find query node
                const queryNode = nodes.find(n => n.id === 'query');
                if (!queryNode) return null;

                const isEvidence = node.type === 'evidence';
                
                // Compute thickness based on SHAP
                let strokeWidth = 2;
                let strokeColor = '#334155';
                
                if (isEvidence) {
                  strokeWidth = Math.max(2, Math.min(10, Math.abs(node.shap) / 4.5));
                  strokeColor = node.shap >= 0 ? '#00D4FF' : '#8B5CF6';
                } else {
                  strokeWidth = 2.5;
                  strokeColor = '#EF4444'; // Red detective board thread
                }

                return (
                  <g key={`link-${node.id}`}>
                    <line 
                      x1={queryNode.x} 
                      y1={queryNode.y} 
                      x2={node.x} 
                      y2={node.y} 
                      stroke={strokeColor} 
                      strokeWidth={strokeWidth}
                      className={isEvidence ? "flow-line" : ""}
                      strokeDasharray={isEvidence ? "6, 4" : ""}
                      opacity="0.85"
                    />
                  </g>
                );
              })}
            </svg>

            {/* DOM Node Cards */}
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 pointer-events-none">
                <div className="text-navy-800/40 font-black text-4xl tracking-widest uppercase mb-2">NO ACTIVE TARGET</div>
                <div className="text-cyan/60 font-mono text-xs tracking-wider uppercase">Await target query... Enter a search query above to populate nodes</div>
              </div>
            )}
            {nodes.map(node => {
              const isQuery = node.type === 'query';
              const isEvidence = node.type === 'evidence';
              
              let cardClass = "absolute select-none cursor-grab active:cursor-grabbing px-4 py-2.5 rounded-md border text-center transition-shadow ";
              
              if (isQuery) {
                cardClass += "bg-navy-800 border-cyan text-cyan font-black text-sm shadow-[0_0_15px_rgba(0,212,255,0.25)] pulse-glow-cyan";
              } else if (isEvidence) {
                cardClass += "bg-navy-800 border-cyan text-white text-xs hover:shadow-[0_0_15px_rgba(0,212,255,0.2)] pulse-glow-cyan";
              } else {
                cardClass += "bg-navy-800 border-violet text-white text-xs hover:shadow-[0_0_15px_rgba(139,92,246,0.2)] pulse-glow-violet";
              }

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleMouseDown(e, node.id)}
                  onClick={() => handleNodeClick(node)}
                  onDoubleClick={() => handleContextDoubleClick(node)}
                  className={cardClass}
                  style={{
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    transform: 'translate(-50%, -50%)',
                    width: isQuery ? '190px' : '155px',
                    zIndex: isQuery ? 30 : 20
                  }}
                >
                  <div className={`text-[9px] font-black uppercase mb-1 tracking-wider ${isQuery || isEvidence ? 'text-cyan' : 'text-violet'}`}>
                    {node.label}
                  </div>
                  <div className="text-xs font-bold leading-tight line-clamp-2">
                    {node.title}
                  </div>
                  {!isQuery && (
                    <div className="text-[8px] font-bold text-[#94A3B8] mt-1.5 uppercase">
                      {isEvidence ? `SHAP: ${node.shap >= 0 ? '+' : ''}${node.shap}%` : "Double Click Target"}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Canvas overlay note */}
            <div className="absolute bottom-3 left-4 text-[10px] font-bold text-[#94A3B8] pointer-events-none">
              * Click evidence cards (cyan) to slide side-panel. Double click contextual labels (violet) to query entities. Drag nodes to restructure board.
            </div>
          </div>
        </section>

        {/* Tabbed XAI Diagnostics (SHAP & LIME) */}
        <section className="bg-navy-800 border border-navy-800 rounded-lg p-6 shadow-2xl relative">
          <div className="flex border-b border-navy-900 pb-px mb-5 gap-6">
            <button
              onClick={() => setActiveTab("shap")}
              className={`pb-3 text-sm font-black uppercase tracking-wider transition-cyber relative ${activeTab === 'shap' ? 'text-cyan' : 'text-[#94A3B8] hover:text-white'}`}
            >
              [ SHAP Analysis ]
              {activeTab === 'shap' && (
                <div className="absolute bottom-[-1.5px] left-0 right-0 h-0.5 bg-cyan rounded-full shadow-[0_0_8px_#00D4FF]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("lime")}
              className={`pb-3 text-sm font-black uppercase tracking-wider transition-cyber relative ${activeTab === 'lime' ? 'text-violet' : 'text-[#94A3B8] hover:text-white'}`}
            >
              [ LIME Analysis ]
              {activeTab === 'lime' && (
                <div className="absolute bottom-[-1.5px] left-0 right-0 h-0.5 bg-violet rounded-full shadow-[0_0_8px_#8B5CF6]" />
              )}
            </button>
          </div>

          <div className="min-h-[220px]">
            {activeTab === 'shap' ? (
              <div className="flex flex-col gap-6 animated-fade">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-cyan mb-4">Web Source Attributions (SHAP)</h3>
                  
                  {/* Clean custom CSS horizontal bar chart */}
                  <div className="flex flex-col gap-3">
                    {currentData.evidence.map((ev) => {
                      const maxVal = Math.max(...currentData.evidence.map(e => Math.abs(e.shap)));
                      const widthPercent = `${Math.max(10, Math.min(100, (Math.abs(ev.shap) / maxVal) * 80))}%`;
                      const isPositive = ev.shap >= 0;

                      return (
                        <div key={`chart-row-${ev.id}`} className="flex items-center text-xs">
                          <div className="w-28 font-bold text-[#94A3B8] truncate">{ev.label}</div>
                          <div className="flex-1 bg-navy-950 rounded h-6 relative overflow-hidden flex items-center px-2">
                            <div 
                              className={`h-full absolute left-0 top-0 rounded ${isPositive ? 'bg-cyan' : 'bg-violet'}`} 
                              style={{ width: widthPercent, opacity: 0.85 }} 
                            />
                            <span className="relative z-10 font-black text-[10px] text-white">
                              {ev.title}
                            </span>
                          </div>
                          <div className={`w-16 text-right font-black ${isPositive ? 'text-cyan' : 'text-violet'}`}>
                            {ev.shap >= 0 ? '+' : ''}{ev.shap}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-cyan/10 border border-cyan/30 text-cyan rounded-md p-4 text-sm font-bold flex items-center gap-2">
                  <span className="text-[10px] border border-cyan px-2 py-0.5 rounded uppercase font-black tracking-wider bg-cyan/20">INFO</span>
                  {currentData.shapConclusion}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-5 animated-fade">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-violet mb-3">LIME Local Word Importance</h3>
                  <div className="highlight-container leading-relaxed">
                    {renderLimeHighlights(currentData.limeText, currentData.limeHighlights)}
                  </div>
                </div>

                <div className="bg-violet/10 border border-violet/30 text-violet rounded-md p-4 text-sm font-bold flex items-center gap-2">
                  <span className="text-[10px] border border-violet px-2 py-0.5 rounded uppercase font-black tracking-wider bg-violet/20 font-black">LIME</span>
                  {currentData.limeConclusion}
                </div>
              </div>
            )}
          </div>
        </section>

      </main>

      {/* LIME Glassmorphism sliding panel */}
      <div className={`fixed top-0 right-0 h-full w-[380px] bg-navy-800/80 backdrop-blur-glass border-l border-navy-800 shadow-2xl p-6 transition-cyber z-50 overflow-y-auto flex flex-col gap-5 ${activeSidePanelNode ? 'translate-x-0' : 'translate-x-full'}`}>
        {activeSidePanelNode && (
          <>
            <div className="flex justify-between items-center pb-2 border-b border-navy-900">
              <span className="text-cyan text-[10px] font-black uppercase tracking-widest">Evidence Source details</span>
              <button 
                onClick={() => setActiveSidePanelNode(null)}
                className="text-error border border-error/50 hover:bg-error hover:text-navy-900 text-xs px-2.5 py-1 font-black uppercase rounded tracking-wider transition-cyber"
              >
                Close
              </button>
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-[#94A3B8]">{activeSidePanelNode.label}</span>
              <h3 className="text-lg font-black text-white mt-1 leading-tight">{activeSidePanelNode.title}</h3>
            </div>
            
            <div className="flex-1 flex flex-col gap-4">
              <div className="bg-navy-950 border border-navy-800 rounded-md p-4">
                <div className="text-[9px] font-black text-cyan uppercase tracking-wider mb-2">[RAW EXTRACTED SNIPPET]</div>
                <p className="text-sm font-bold text-white leading-relaxed">
                  {renderLimeHighlights(activeSidePanelNode.snippet, currentData.limeHighlights)}
                </p>
              </div>

              <div className="bg-navy-950 border border-navy-800 rounded-md p-4 flex flex-col gap-2">
                <div className="text-[9px] font-black text-violet uppercase tracking-wider">[XAI LOCAL CONTRIBUTION]</div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[#94A3B8]">SHAP Impact:</span>
                  <span className="font-black text-cyan">+{activeSidePanelNode.shap}%</span>
                </div>
                <div className="h-1.5 w-full bg-navy-800 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-cyan" style={{ width: `${activeSidePanelNode.shap}%` }} />
                </div>
              </div>
            </div>

            <a 
              href={activeSidePanelNode.url}
              target="_blank"
              rel="noreferrer"
              className="w-full text-center border border-cyan text-cyan rounded-md py-3 font-black uppercase text-xs tracking-widest hover:bg-cyan hover:text-navy-900 hover:shadow-[0_0_20px_#00D4FF] transition-cyber block mt-auto"
            >
              Visit Original Source
            </a>
          </>
        )}
      </div>

    </div>
  );
}

export default App;
