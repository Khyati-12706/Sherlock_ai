import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [query, setQuery] = useState("Rashmika Mandanna Vijay Deverakonda wedding");
  const [decryptText, setDecryptText] = useState("");
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [activeSidePanelNode, setActiveSidePanelNode] = useState(null);
  const [isCerebrasLoading, setIsCerebrasLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("EXTRACTING");
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Collapsible History States
  const [history, setHistory] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [currentData, setCurrentData] = useState({
    summary: "",
    keywords: [],
    evidence: [],
    contextual: [],
    insufficientEvidence: false,
    auditTrail: [],
    claims: [],
    autonomyNote: "",
    confidenceExplanation: ""
  });

  // Graph Nodes State
  const [nodes, setNodes] = useState([]);
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const boardRef = useRef(null);

  // Setup coordinates for nodes dynamically
  const setupBoardNodes = (targetQuery, data) => {
    const canvasWidth = 960;
    const canvasHeight = 440;
    const center = { x: canvasWidth / 2, y: canvasHeight / 2 };
    
    const calculatedNodes = [
      { id: 'query', type: 'query', label: 'Target Query', title: targetQuery, x: center.x, y: center.y }
    ];

    // Orbiting Evidence nodes
    const evCount = data.evidence ? data.evidence.length : 0;
    if (data.evidence) {
      data.evidence.forEach((ev, i) => {
        const angle = (i * 2 * Math.PI) / (evCount || 1) - Math.PI / 2;
        calculatedNodes.push({
          ...ev,
          type: 'evidence',
          shap: ev.relevanceScore || 0,
          x: center.x + 200 * Math.cos(angle),
          y: center.y + 140 * Math.sin(angle)
        });
      });
    }

    // Orbiting Contextual nodes
    const ctxCount = data.contextual ? data.contextual.length : 0;
    if (data.contextual) {
      data.contextual.forEach((ctx, i) => {
        const angle = (i * 2 * Math.PI) / (ctxCount || 1) + Math.PI / 4;
        calculatedNodes.push({
          ...ctx,
          type: 'context',
          x: center.x + 360 * Math.cos(angle),
          y: center.y + 190 * Math.sin(angle)
        });
      });
    }

    setNodes(calculatedNodes);
  };

  // Trigger Decrypting Text Animation
  const triggerDecryption = (finalMsg) => {
    setIsDecrypting(true);
    let count = 0;
    const displayMsg = finalMsg || "No intelligence found.";
    const chars = "XYZ019#@$!%&?*[]{}";
    
    const decryptionInterval = setInterval(() => {
      let scramble = "";
      for (let i = 0; i < displayMsg.length; i++) {
        if (i < count) {
          scramble += displayMsg[i];
        } else if (i < count + 5) {
          scramble += chars[Math.floor(Math.random() * chars.length)];
        }
      }
      setDecryptText(scramble);
      count += 5;
      
      if (count >= displayMsg.length + 5) {
        clearInterval(decryptionInterval);
        setDecryptText(displayMsg);
        setIsDecrypting(false);
      }
    }, 20);
  };

  // Load target details from collapsible history without fetching again
  const loadFromHistory = (item) => {
    setQuery(item.query);
    setCurrentData(item.data);
    setupBoardNodes(item.query, item.data);
    setDecryptText(item.data.summary);
    setActiveSidePanelNode(null);
  };

  // Trigger investigation
  const executeInvestigation = () => {
    const cleanQ = query.trim();
    if (!cleanQ) {
      setNodes([]);
      setDecryptText("Waiting for target input...");
      setIsDecrypting(false);
      setCurrentData({
        summary: "",
        keywords: [],
        evidence: [],
        contextual: [],
        insufficientEvidence: false,
        auditTrail: [],
        claims: [],
        autonomyNote: "",
        confidenceExplanation: ""
      });
      return;
    }

    setIsCerebrasLoading(true);
    setLoadingProgress(0);
    setLoadingStage("EXTRACTING");
    setDecryptText("Opening Server-Sent Events (SSE) secure link...");
    setActiveSidePanelNode(null);

    // EventSource streams GET /api/investigate?query=...
    const eventSource = new EventSource(`/api/investigate?query=${encodeURIComponent(cleanQ)}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle progress updates
        if (data.stage) {
          setLoadingStage(data.stage);
          setLoadingProgress(data.progress);
        }

        // Handle final payload
        if (data.result) {
          const payload = data.result;
          setCurrentData(payload);
          setupBoardNodes(cleanQ, payload);
          triggerDecryption(payload.summary);
          
          // Append to history session list
          setHistory(prev => {
            if (!prev.find(h => h.query === cleanQ)) {
              return [{ query: cleanQ, data: payload }, ...prev];
            }
            return prev;
          });

          setIsCerebrasLoading(false);
          eventSource.close();
        }

        // Handle error responses streamed from backend
        if (data.error) {
          console.error("Investigation server error:", data.error);
          setDecryptText("Connection failed - unable to retrieve intelligence");
          setIsCerebrasLoading(false);
          eventSource.close();
        }
      } catch (err) {
        console.error("SSE message parse error:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE connection failure:", err);
      setDecryptText("Connection failed - unable to retrieve intelligence");
      setIsCerebrasLoading(false);
      eventSource.close();
    };
  };

  // Run initial investigation on load
  useEffect(() => {
    executeInvestigation();
  }, []);

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

  // Node Clicking (Opens Details Panel)
  const handleNodeClick = (node) => {
    if (node.type === 'evidence' || node.type === 'context') {
      setActiveSidePanelNode(node);
    }
  };

  // Double click Contextual Node triggers new query
  const handleContextDoubleClick = (node) => {
    setQuery(node.title);
    // Trigger new search manually since state update is asynchronous
    setTimeout(() => {
      setQuery(prev => {
        executeInvestigation();
        return prev;
      });
    }, 50);
  };

  // Highlights keywords in summary text block
  const renderSummaryHighlights = (text, highlights) => {
    if (!highlights || highlights.length === 0) return text;
    
    // Sort highlights by length descending to prevent substring issues
    const sorted = [...highlights].sort((a, b) => b.length - a.length);
    let html = text;
    
    sorted.forEach(word => {
      if (word.length < 2) return;
      const regex = new RegExp(`\\b(${word})\\b`, 'gi');
      html = html.replace(regex, `<span class="px-1.5 py-0.5 rounded font-bold bg-violet text-[#F8FAFC] shadow-[0_0_8px_#8B5CF6] border border-violet/30">$1</span>`);
    });

    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  // Compute Statistics for Stats Row
  const computeStats = () => {
    const evidence = currentData.evidence || [];
    if (evidence.length === 0) return { avgShap: 0, confidence: 0, diversity: 0 };
    
    const totalShap = evidence.reduce((acc, curr) => acc + (curr.relevanceScore || 0), 0);
    const avgShap = Math.round(totalShap / evidence.length);

    // Source diversity based on domain name
    const uniqueDomains = new Set(evidence.map(e => e.label).filter(Boolean));
    const diversity = uniqueDomains.size;

    // Confidence Score Math
    const baseConf = Math.min(100, evidence.length * 25);
    const conflictCount = evidence.filter(e => e.conflict).length;
    const confidence = Math.max(0, Math.min(100, baseConf - (conflictCount * 30)));

    return { avgShap, confidence, diversity };
  };

  const { avgShap, confidence, diversity } = computeStats();
  const isLowConfidence = !isCerebrasLoading && currentData.summary && confidence < 40;

  // Source Diversity Description
  const getDiversityBadge = (count) => {
    if (count >= 4) return { text: "STRONG CORROBORATION", class: "border-cyan text-cyan bg-cyan/15" };
    if (count >= 2) return { text: "MODERATE CORROBORATION", class: "border-violet text-violet bg-violet/15" };
    return { text: "WEAK CORROBORATION", class: "border-warning text-warning bg-warning/15" };
  };
  const diversityBadge = getDiversityBadge(diversity);

  // Dynamic tooltip for SHAP explanation
  const getShapTooltip = () => {
    const evidence = currentData.evidence || [];
    const highRelevance = evidence.filter(e => e.relevanceScore >= 70).length;
    const conflicts = evidence.filter(e => e.conflict).length;
    return `${highRelevance}/${evidence.length} sources rated ≥70% relevance. ${conflicts} conflict(s) flagged.`;
  };

  const explainConfidence = () => {
    if (!currentData.confidenceExplanation) {
      return 'The confidence score is based on the number of sources, agreement between them, and their average relevance.';
    }
    return currentData.confidenceExplanation;
  };

  const showWhy = (score, reason) => {
    if (!score && score !== 0) return;
    window.alert(`${reason}\n\nScore: ${score}`);
  };

  return (
    <div className="min-h-screen bg-navy-900 text-[#F8FAFC] p-6 relative overflow-hidden select-none">
      
      {/* Ambient decorative glowing backdrops */}
      <div className="absolute top-[-100px] left-[20%] w-[500px] h-[500px] rounded-full bg-violet/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[20%] w-[500px] h-[500px] rounded-full bg-cyan/10 blur-[120px] pointer-events-none" />

      {/* Collapse History Sidebar */}
      <div className={`fixed top-0 left-0 h-full w-[280px] bg-navy-800/95 backdrop-blur-glass border-r border-navy-800 shadow-2xl p-5 transition-cyber z-50 overflow-y-auto flex flex-col gap-4 ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex justify-between items-center pb-2 border-b border-navy-900">
          <span className="text-cyan text-[10px] font-black uppercase tracking-widest">Investigation History</span>
          <button 
            onClick={() => setIsHistoryOpen(false)}
            className="text-error border border-error/50 hover:bg-error hover:text-navy-900 text-[10px] px-2 py-0.5 font-black uppercase rounded tracking-wider transition-cyber cursor-pointer"
          >
            Close
          </button>
        </div>
        <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1">
          {history.length === 0 ? (
            <div className="text-xs text-navy-800 font-mono text-center mt-10">NO PRIOR HISTORY</div>
          ) : (
            history.map((item, idx) => (
              <button
                key={`hist-${idx}`}
                onClick={() => {
                  loadFromHistory(item);
                  setIsHistoryOpen(false);
                }}
                className="w-full text-left bg-navy-950 hover:bg-cyan/10 border border-navy-900 hover:border-cyan text-white hover:text-cyan p-3 rounded text-xs font-bold transition-cyber truncate cursor-pointer"
              >
                {item.query}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Header bar */}
      <header className="flex justify-between items-center border-b border-navy-800 pb-4 mb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">SHERLOCK AI</h1>
          <p className="text-cyan text-xs font-extrabold uppercase tracking-[0.25em] mt-1">Autonomous OSINT & Explainability Dashboard</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="bg-navy-850 hover:bg-cyan/15 text-[#94A3B8] hover:text-cyan border border-navy-800 hover:border-cyan px-4 py-2 text-xs font-black uppercase rounded tracking-wider transition-cyber cursor-pointer"
          >
            [ HISTORY ]
          </button>
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-cyan animate-pulse" />
            <span className="border border-violet/50 text-violet px-3 py-1 text-xs font-black uppercase rounded tracking-wider bg-violet/10">
              SYSTEM ONLINE
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto flex flex-col gap-6">
        
        {/* Search bar & Terminal */}
        <section className="flex flex-col gap-4">
          <div className="bg-navy-800 border border-navy-800 rounded-lg p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-cyan" />
              <h2 className="text-xs font-black uppercase tracking-wider text-[#94A3B8]">Investigation Target</h2>
            </div>
            
            <div className="flex gap-4">
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && executeInvestigation()}
                placeholder="Enter search query..."
                className="flex-1 bg-navy-950 border border-navy-800 rounded-md px-4 py-3 text-white font-bold placeholder-navy-800 focus:outline-none focus:border-cyan focus:shadow-[0_0_15px_rgba(0,212,255,0.2)] transition-cyber text-base"
              />
              <button 
                onClick={executeInvestigation}
                className="bg-navy-800 text-cyan border border-cyan rounded-md px-6 font-black uppercase tracking-wider hover:bg-cyan hover:text-navy-900 hover:shadow-[0_0_20px_#00D4FF] transition-cyber text-sm min-w-[160px] cursor-pointer"
              >
                Analyze
              </button>
            </div>

            {/* Terminal Box */}
            <div className={`bg-navy-950 border rounded p-4 font-mono text-sm min-h-[95px] flex flex-col gap-2 relative transition-cyber ${isLowConfidence ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'border-navy-800'}`}>
              <div className="text-xs font-bold tracking-wider flex justify-between">
                <span className="text-cyan">[TERMINAL DECRYPT INTEL]</span>
                {isCerebrasLoading && <span className="animate-pulse text-warning font-black">🤖 SYNTHESIZING STAGE: {loadingStage}...</span>}
                {isLowConfidence && <span className="animate-pulse text-red-500 font-extrabold">⚠ LOW CONFIDENCE — VERIFY MANUALLY</span>}
              </div>
              <p className={`font-bold leading-relaxed text-sm ${isDecrypting ? 'text-cyan font-mono' : 'text-[#F8FAFC] font-sans'}`}>
                {isDecrypting ? decryptText : renderSummaryHighlights(decryptText, currentData.keywords)}
              </p>
            </div>

            {/* Auto-suggest branch queries chips */}
            {!isCerebrasLoading && currentData.contextual.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-[10px] font-black uppercase text-[#94A3B8] tracking-widest">Branch Investigation:</span>
                {currentData.contextual.slice(0, 3).map((ctx) => (
                  <button
                    key={`suggest-${ctx.id}`}
                    onClick={() => {
                      setQuery(ctx.title);
                      setTimeout(() => executeInvestigation(), 50);
                    }}
                    className="bg-navy-950 hover:bg-violet/20 border border-violet/30 hover:border-violet text-violet hover:text-white px-2.5 py-1 rounded text-xs font-black uppercase tracking-wider transition-cyber cursor-pointer"
                  >
                    {ctx.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Stats cards row (SHAP & Confidence) */}
        {!isCerebrasLoading && currentData.summary && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Overall SHAP Card */}
            <div className="bg-navy-800 border border-cyan/30 rounded-lg p-5 shadow-lg flex justify-between items-center shadow-[0_0_15px_rgba(0,212,255,0.05)]">
              <div>
                <span className="text-[10px] font-black uppercase text-cyan tracking-widest">Overall SHAP Score</span>
                <div className="flex items-baseline gap-2 mt-2 group relative">
                  <button
                    type="button"
                    onClick={() => showWhy(avgShap, 'This score is the average relevance across the evidence items after the server applied the scoring rules and fallback heuristics.')}
                    className="text-3xl font-black text-white hover:text-cyan transition-cyber cursor-help"
                  >
                    {avgShap}%
                  </button>
                  <span className="text-[10px] font-bold text-[#94A3B8] uppercase">avg relevance</span>
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 left-0 hidden group-hover:block bg-navy-950 border border-cyan/40 text-cyan text-[10px] py-1.5 px-3 rounded shadow-2xl z-50 font-mono w-64 pointer-events-none">
                    {getShapTooltip()}
                  </div>
                </div>
                <p className="text-[10px] text-[#94A3B8] mt-1 uppercase font-bold">Calculated from web attributions</p>
              </div>

              {/* Mini Radial Gauge */}
              <div className="relative w-14 h-14">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-navy-950"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-cyan transition-all duration-1000"
                    strokeDasharray={`${avgShap}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-cyan">
                  {avgShap}
                </div>
              </div>
            </div>

            {/* Confidence Score Card */}
            <div className={`bg-navy-800 border rounded-lg p-5 shadow-lg flex justify-between items-center transition-cyber ${isLowConfidence ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)]' : 'border-violet/30 shadow-[0_0_15px_rgba(139,92,246,0.05)]'}`}>
              <div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${isLowConfidence ? 'text-red-400' : 'text-violet'}`}>Confidence Score</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => showWhy(confidence, explainConfidence())}
                    className={`text-3xl font-black ${isLowConfidence ? 'text-red-500' : 'text-white'}`}
                  >
                    {confidence}%
                  </button>
                  <span className="text-[10px] font-bold text-[#94A3B8] uppercase">corroboration weight</span>
                </div>
                
                {/* Source Diversity Badge */}
                <div className={`inline-block border px-2 py-0.5 rounded text-[8px] font-black tracking-wider uppercase mt-2 ${diversityBadge.class}`}>
                  {diversityBadge.text}
                </div>
              </div>

              <div className="flex flex-col items-end justify-center font-mono">
                <div className="text-[10px] font-black text-[#94A3B8] uppercase">Diversity Score</div>
                <div className="text-xl font-bold text-white mt-1">{diversity} <span className="text-xs text-[#94A3B8]">Domains</span></div>
              </div>
            </div>

          </section>
        )}

        {/* Map Board */}
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
              {!isCerebrasLoading && nodes.map((node) => {
                if (node.id === 'query') return null;
                
                const queryNode = nodes.find(n => n.id === 'query');
                if (!queryNode) return null;

                const isEvidence = node.type === 'evidence';
                
                let strokeWidth = 2;
                let strokeColor = '#334155';
                
                if (isEvidence) {
                  strokeWidth = Math.max(2, Math.min(10, Math.abs(node.shap) / 4.5));
                  strokeColor = node.conflict ? '#EF4444' : (node.shap >= 0 ? '#00D4FF' : '#8B5CF6');
                } else {
                  strokeWidth = 2.5;
                  strokeColor = '#8B5CF6'; // Violet thread
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

            {/* Rotating progress loading SVG ring overlay */}
            {isCerebrasLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-navy-950/70 backdrop-blur-sm z-40 transition-opacity duration-500">
                <div className="relative flex items-center justify-center">
                  <svg className="w-56 h-56 transform -rotate-90" viewBox="0 0 100 100">
                    <defs>
                      <linearGradient id="cyber-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#00D4FF" />
                        <stop offset="100%" stopColor="#8B5CF6" />
                      </linearGradient>
                    </defs>
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#1E293B"
                      strokeWidth="5"
                      fill="transparent"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="url(#cyber-gradient)"
                      strokeWidth="5"
                      fill="transparent"
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 - (251.2 * loadingProgress) / 100}
                      strokeLinecap="round"
                      className="transition-all duration-500 ease-out"
                    />
                  </svg>
                  
                  {/* Stage percentage and details inside ring */}
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-white text-3xl font-black tracking-tight">{loadingProgress}%</span>
                    <span className="text-cyan text-[9px] font-black tracking-widest uppercase mt-1 animate-pulse">{loadingStage}</span>
                  </div>
                </div>
              </div>
            )}

            {/* DOM Node Cards */}
            {!isCerebrasLoading && nodes.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 pointer-events-none">
                <div className="text-navy-800/40 font-black text-4xl tracking-widest uppercase mb-2">NO ACTIVE TARGET</div>
                <div className="text-cyan/60 font-mono text-xs tracking-wider uppercase">Await target query... Enter a search query above to populate nodes</div>
              </div>
            )}
            
            {!isCerebrasLoading && nodes.map(node => {
              const isQuery = node.type === 'query';
              const isEvidence = node.type === 'evidence';
              
              let cardClass = "absolute select-none cursor-grab active:cursor-grabbing px-4 py-2.5 rounded-md border text-center transition-shadow ";
              
              if (isQuery) {
                cardClass += "bg-navy-800 border-cyan text-cyan font-black text-sm shadow-[0_0_15px_rgba(0,212,255,0.25)] pulse-glow-cyan";
              } else if (isEvidence) {
                if (node.conflict) {
                  cardClass += "bg-navy-800 border-red-500 text-white text-xs hover:shadow-[0_0_15px_rgba(239,68,68,0.35)] pulse-glow-red";
                } else {
                  cardClass += "bg-navy-800 border-cyan text-white text-xs hover:shadow-[0_0_15px_rgba(0,212,255,0.2)] pulse-glow-cyan";
                }
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
                  <div className={`text-[9px] font-black uppercase mb-1 tracking-wider ${isQuery ? 'text-cyan' : (isEvidence ? (node.conflict ? 'text-red-500' : 'text-cyan') : 'text-violet')}`}>
                    {node.conflict ? '⚠️ CONFLICT' : node.label}
                  </div>
                  <div className="text-xs font-bold leading-tight line-clamp-2">
                    {node.title}
                  </div>
                  {!isQuery && (
                    <div className="text-[8px] font-bold text-[#94A3B8] mt-1.5 uppercase">
                      {isEvidence ? `SHAP: ${node.shap >= 0 ? '+' : ''}${node.shap}%` : "Click for Summary"}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Canvas overlay instructions */}
            <div className="absolute bottom-3 left-4 text-[10px] font-bold text-[#94A3B8] pointer-events-none">
              * Click evidence (cyan) or entities (violet) to view details in side-panel. Double click entities to query them. Drag nodes to restructure board.
            </div>
          </div>
        </section>

        {/* SHAP Attributions Bar Chart */}
        {!isCerebrasLoading && currentData.evidence && currentData.evidence.length > 0 && (
          <section className="bg-navy-800 border border-navy-800 rounded-lg p-6 shadow-2xl relative">
            <h3 className="text-xs font-black uppercase tracking-wider text-cyan mb-4">Web Source Attributions (SHAP)</h3>
            
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                {currentData.evidence.map((ev) => {
                  const maxVal = Math.max(...currentData.evidence.map(e => Math.abs(e.relevanceScore)));
                  const widthPercent = `${Math.max(10, Math.min(100, (Math.abs(ev.relevanceScore) / (maxVal || 1)) * 80))}%`;

                  return (
                    <button
                      key={`chart-row-${ev.id}`} 
                      type="button"
                      onClick={() => showWhy(ev.relevanceScore, `This source scored ${ev.relevanceScore} because it directly matched the query, had strong recency/authority signals, and included specific facts.`)}
                      className="flex items-center text-xs text-left hover:bg-cyan/5 rounded transition-cyber"
                    >
                      <div className="w-28 font-bold text-[#94A3B8] truncate">{ev.label}</div>
                      <div className="flex-1 bg-navy-950 rounded h-6 relative overflow-hidden flex items-center px-2">
                        <div 
                          className="h-full absolute left-0 top-0 rounded bg-cyan" 
                          style={{ width: widthPercent, opacity: 0.85 }} 
                        />
                        <span className="relative z-10 font-black text-[10px] text-white">
                          {ev.title}
                        </span>
                      </div>
                      <div className="w-16 text-right font-black text-cyan">
                        +{ev.relevanceScore}%
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="bg-cyan/10 border border-cyan/30 text-cyan rounded-md p-4 text-sm font-bold flex items-center gap-2">
                  <span className="text-[10px] border border-cyan px-2 py-0.5 rounded uppercase font-black tracking-wider bg-cyan/20">INFO</span>
                  {`Conclusion: Average attributions across sources resolved to ${avgShap}% overall correlation. Conflict detected: ${currentData.evidence.some(e => e.conflict) ? 'Yes' : 'No'}.`}
                </div>
                <div className="bg-navy-950 border border-navy-800 rounded-md p-4 text-sm">
                  <div className="text-[10px] font-black uppercase tracking-wider text-violet">Autonomy Trail</div>
                  <p className="text-[#94A3B8] font-bold mt-2">{currentData.autonomyNote || 'The agent followed a multi-step evidence path and surfaced the strongest corroboration it found.'}</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                <div className="bg-navy-950 border border-navy-800 rounded-md p-4">
                  <div className="text-[10px] font-black uppercase tracking-wider text-cyan">Claim Breakdown</div>
                  <div className="mt-3 flex flex-col gap-3">
                    {(currentData.claims || []).map((claim, idx) => (
                      <div key={`claim-${idx}`} className="border border-navy-800 rounded p-3">
                        <div className="text-sm font-black text-white">{claim.claim}</div>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {claim.breakdown.map((bar) => (
                            <span key={`${claim.claim}-${bar.label}`} className="text-[10px] bg-cyan/10 text-cyan px-2 py-1 rounded uppercase font-black tracking-wider">
                              {bar.label}: {bar.value}%
                            </span>
                          ))}
                        </div>
                        <div className="mt-2 text-[11px] text-[#94A3B8]">Confidence {claim.confidence}%</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-navy-950 border border-navy-800 rounded-md p-4">
                  <div className="text-[10px] font-black uppercase tracking-wider text-violet">Audit Trail</div>
                  <div className="mt-3 flex flex-col gap-2">
                    {(currentData.auditTrail || []).map((item) => (
                      <div key={`audit-${item.step}`} className="border-l-2 border-cyan/40 pl-3 py-1">
                        <div className="text-[10px] font-black uppercase tracking-wider text-cyan">[{item.step}] {item.label}</div>
                        <div className="text-sm text-[#94A3B8] mt-1">{item.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

      </main>

      {/* Glassmorphism slide-out side panel */}
      <div className={`fixed top-0 right-0 h-full w-[380px] bg-navy-800/80 backdrop-blur-glass border-l border-navy-800 shadow-2xl p-6 transition-cyber z-50 overflow-y-auto flex flex-col gap-5 ${activeSidePanelNode ? 'translate-x-0' : 'translate-x-full'}`}>
        {activeSidePanelNode && (
          <>
            <div className="flex justify-between items-center pb-2 border-b border-navy-900">
              <span className={`text-[10px] font-black uppercase tracking-widest ${activeSidePanelNode.type === 'context' ? 'text-violet' : 'text-cyan'}`}>
                {activeSidePanelNode.type === 'context' ? 'Entity Details' : 'Evidence Source details'}
              </span>
              <button 
                onClick={() => setActiveSidePanelNode(null)}
                className="text-error border border-error/50 hover:bg-error hover:text-navy-900 text-xs px-2.5 py-1 font-black uppercase rounded tracking-wider transition-cyber cursor-pointer"
              >
                Close
              </button>
            </div>
            <div>
              <span className={`text-xs font-black uppercase tracking-widest ${activeSidePanelNode.type === 'context' ? 'text-violet' : 'text-[#94A3B8]'}`}>
                {activeSidePanelNode.label}
              </span>
              <h3 className="text-lg font-black text-white mt-1 leading-tight">{activeSidePanelNode.title}</h3>
            </div>
            
            <div className="flex-1 flex flex-col gap-4">
              <div className="bg-navy-950 border border-navy-800 rounded-md p-4">
                <div className={`text-[9px] font-black uppercase tracking-wider mb-2 ${activeSidePanelNode.type === 'context' ? 'text-violet' : 'text-cyan'}`}>
                  {activeSidePanelNode.type === 'context' ? '[WIKIPEDIA SUMMARY]' : '[RAW EXTRACTED SNIPPET]'}
                </div>
                <p className="text-sm font-bold text-white leading-relaxed">
                  {activeSidePanelNode.type === 'context'
                    ? activeSidePanelNode.snippet
                    : renderSummaryHighlights(activeSidePanelNode.snippet, currentData.keywords)
                  }
                </p>
              </div>

              {activeSidePanelNode.type !== 'context' && (
                <div className="bg-navy-950 border border-navy-800 rounded-md p-4 flex flex-col gap-2">
                  <div className="text-[9px] font-black text-violet uppercase tracking-wider">[XAI LOCAL CONTRIBUTION]</div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-[#94A3B8]">SHAP Impact:</span>
                    <span className="font-black text-cyan">+{activeSidePanelNode.shap}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-navy-800 rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-cyan" style={{ width: `${activeSidePanelNode.shap ?? activeSidePanelNode.relevanceScore ?? 0}%` }} />
                  </div>
                </div>
              )}
            </div>

            {activeSidePanelNode.url && (
              <a 
                href={activeSidePanelNode.url}
                target="_blank"
                rel="noreferrer"
                className={`w-full text-center border rounded-md py-3 font-black uppercase text-xs tracking-widest transition-cyber block mt-auto ${activeSidePanelNode.type === 'context' ? 'border-violet text-violet hover:bg-violet hover:text-navy-900 hover:shadow-[0_0_20px_#8B5CF6]' : 'border-cyan text-cyan hover:bg-cyan hover:text-navy-900 hover:shadow-[0_0_20px_#00D4FF]'}`}
              >
                Visit Original Source
              </a>
            )}
          </>
        )}
      </div>

    </div>
  );
}

export default App;
