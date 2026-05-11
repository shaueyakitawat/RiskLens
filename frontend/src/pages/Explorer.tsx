import React, { useState, useEffect, useRef } from 'react';
import { Network, Search, Brain, Info, Layers, RefreshCw } from 'lucide-react';
import { api, GraphNode, GraphLink } from '../utils/api';
import { RiskExplanationModal } from '../components/RiskExplanationModal';

interface ExplorerProps {
  selectedCompany: string;
  setSelectedCompany: (company: string) => void;
}

interface VisualNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number;
  fy?: number;
}

export const ExplorerPage: React.FC<ExplorerProps> = ({
  selectedCompany,
  setSelectedCompany,
}) => {
  const [companies, setCompanies] = useState<string[]>([]);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Explain Risk Modal States
  const [explainingRisk, setExplainingRisk] = useState<VisualNode | null>(null);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nodesRef = useRef<VisualNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const animationRef = useRef<number | null>(null);

  // Interaction States
  const draggedNodeRef = useRef<VisualNode | null>(null);
  const hoveredNodeRef = useRef<VisualNode | null>(null);
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const isDraggingCanvasRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const alphaRef = useRef(1.0);

  // Selection States
  const [selectedNode, setSelectedNodeState] = useState<VisualNode | null>(null);
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const isDraggingNodeRef = useRef(false);
  const selectedNodeRef = useRef<VisualNode | null>(null);

  const companyRef = useRef(selectedCompany);

  // Load available companies
  useEffect(() => {
    api.getCompanies()
      .then((data) => setCompanies(data))
      .catch((err) => console.error('Error fetching companies:', err));
  }, []);

  // Load graph data
  useEffect(() => {
    companyRef.current = selectedCompany;
    setLoading(true);
    setError(null);
    setSelectedNodeState(null);
    selectedNodeRef.current = null;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    api.getGraph(selectedCompany || undefined)
      .then((data) => {
        if (companyRef.current === selectedCompany) {
          setGraphData(data);
          if (data.nodes.length === 0) {
            setError('No index records found. Ingest files to render nodes.');
          }
        }
      })
      .catch((err) => {
        console.error(err);
        if (companyRef.current === selectedCompany) {
          setError('Failed to load risk network nodes.');
        }
      })
      .finally(() => {
        if (companyRef.current === selectedCompany) {
          setLoading(false);
        }
      });
  }, [selectedCompany]);

  // Physics & Render Loop
  useEffect(() => {
    if (!graphData || graphData.nodes.length === 0 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set dimensions
    const width = canvas.parentElement?.clientWidth || 800;
    const height = 600;
    canvas.width = width;
    canvas.height = height;

    // Center coordinates
    const cx = width / 2;
    const cy = height / 2;

    // Reset physics temperature on data change
    alphaRef.current = 1.0;

    // Initialize visual nodes with velocities and coordinates in a spiral pattern
    const initializedNodes: VisualNode[] = graphData.nodes.map((node, index) => {
      // Find if we already had coordinates to keep the layout stable
      const existing = nodesRef.current.find((n) => n.id === node.id);
      if (existing) {
        return { ...node, x: existing.x, y: existing.y, vx: existing.vx, vy: existing.vy };
      }
      
      // Spiral layout formula to distribute nodes evenly on start
      const phi = index * 0.45; // spiral angle
      const radius = 25 + index * 6.5; // spiral radius grows outward
      return {
        ...node,
        x: cx + Math.cos(phi) * radius,
        y: cy + Math.sin(phi) * radius,
        vx: 0,
        vy: 0,
      };
    });

    nodesRef.current = initializedNodes;
    linksRef.current = graphData.links;

    // Physics constants adjusted dynamically for node count to stabilize dense graphs
    const nodeCount = graphData.nodes.length;
    const repellingForce = Math.max(30, 220 - nodeCount * 1.8); // Scale down repulsion if dense
    const springForce = nodeCount > 50 ? 0.025 : 0.04;    // Slightly softer springs for large graphs
    const linkLength = nodeCount > 50 ? 65 : 80;      // Shorter links for dense clusters
    const centerAttraction = 0.012; // Gravity strength towards center
    const damping = 0.72;       // Higher friction to dissipate energy quickly

    const tick = () => {
      const nodes = nodesRef.current;
      const links = linksRef.current;
      const alpha = alphaRef.current;

      if (alpha >= 0.005) {
        // 1. Repulsion (Coulomb-like)
        for (let i = 0; i < nodes.length; i++) {
          const nodeA = nodes[i];
          for (let j = i + 1; j < nodes.length; j++) {
            const nodeB = nodes[j];
            const dx = nodeB.x - nodeA.x;
            const dy = nodeB.y - nodeA.y;
            const distSqr = dx * dx + dy * dy + 0.1; // avoid divide by zero
            const dist = Math.sqrt(distSqr);
            
            if (dist < 280) { // Limit repulsion radius
              const force = (repellingForce * (nodeA.val + nodeB.val)) / distSqr;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;

              nodeA.vx -= fx;
              nodeA.vy -= fy;
              nodeB.vx += fx;
              nodeB.vy += fy;
            }
          }
        }

        // 2. Attraction along Links (Hooke's spring-mass)
        for (const link of links) {
          const nodeA = nodes.find((n) => n.id === (typeof link.source === 'string' ? link.source : (link.source as any).id));
          const nodeB = nodes.find((n) => n.id === (typeof link.target === 'string' ? link.target : (link.target as any).id));

          if (nodeA && nodeB) {
            const dx = nodeB.x - nodeA.x;
            const dy = nodeB.y - nodeA.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
            const diff = dist - linkLength;
            const force = diff * springForce;

            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            nodeA.vx += fx;
            nodeA.vy += fy;
            nodeB.vx -= fx;
            nodeB.vy -= fy;
          }
        }

        // 3. Center gravity, velocity capping, and boundary clamping
        const maxV = 5.0; // limit velocity components to prevent chaotic drift
        for (const node of nodes) {
          if (node === draggedNodeRef.current) continue; // Skip updates for dragged node

          // Push to center
          node.vx += (cx - node.x) * centerAttraction;
          node.vy += (cy - node.y) * centerAttraction;

          // Apply damping (friction)
          node.vx *= damping;
          node.vy *= damping;

          // Cap velocity
          node.vx = Math.max(-maxV, Math.min(maxV, node.vx));
          node.vy = Math.max(-maxV, Math.min(maxV, node.vy));

          node.x += node.vx;
          node.y += node.vy;

          // Boundary clamping and velocity zeroing on contact
          if (node.x <= 20) { node.x = 20; node.vx = 0; }
          if (node.x >= width - 20) { node.x = width - 20; node.vx = 0; }
          if (node.y <= 20) { node.y = 20; node.vy = 0; }
          if (node.y >= height - 20) { node.y = height - 20; node.vy = 0; }
        }

        // Decay temperature (faster decay for quick freezing to prevent permanent dancing)
        alphaRef.current *= 0.94;
      } else {
        // Halting calculations. Ensure all velocities are completely zeroed to prevent visual jittering.
        for (const node of nodes) {
          node.vx = 0;
          node.vy = 0;
        }
      }

      // 4. DRAWING
      ctx.clearRect(0, 0, width, height);

      // Draw Grid Background
      ctx.strokeStyle = 'rgba(255,255,255,0.015)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Determine active highlight mode (hover overrides selection)
      const hovered = hoveredNodeRef.current;
      const selected = selectedNodeRef.current;
      const activeNode = hovered || selected;

      const connectedNodes = new Set<string>();
      if (activeNode) {
        connectedNodes.add(activeNode.id);
        for (const link of links) {
          const s = typeof link.source === 'string' ? link.source : (link.source as any).id;
          const t = typeof link.target === 'string' ? link.target : (link.target as any).id;
          if (s === activeNode.id) connectedNodes.add(t);
          if (t === activeNode.id) connectedNodes.add(s);
        }
      }

      // Draw links
      ctx.lineWidth = 1;
      for (const link of links) {
        const nodeA = nodes.find((n) => n.id === (typeof link.source === 'string' ? link.source : (link.source as any).id));
        const nodeB = nodes.find((n) => n.id === (typeof link.target === 'string' ? link.target : (link.target as any).id));

        if (nodeA && nodeB) {
          const isHighlighted = activeNode
            ? connectedNodes.has(nodeA.id) && connectedNodes.has(nodeB.id)
            : true;

          ctx.strokeStyle = isHighlighted
            ? 'rgba(168, 85, 247, 0.25)' // glowing purple
            : 'rgba(255, 255, 255, 0.03)';
          
          ctx.beginPath();
          ctx.moveTo(nodeA.x, nodeA.y);
          ctx.lineTo(nodeB.x, nodeB.y);
          ctx.stroke();
        }
      }

      // Draw nodes
      for (const node of nodes) {
        const radius = node.val / 1.5 + 4;
        const isDimmed = activeNode ? !connectedNodes.has(node.id) && node.group !== 'company' : false;

        // Selected halo indicator
        if (node === selected) {
          ctx.save();
          ctx.strokeStyle = '#22d3ee'; // Cyan halo for selected node
          ctx.lineWidth = 2.5;
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#22d3ee';
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Glow effect
        ctx.save();
        if (!isDimmed) {
          ctx.shadowBlur = radius * 1.5;
          if (node.group === 'company') {
            ctx.shadowColor = '#06b6d4'; // Cyan
            ctx.fillStyle = '#06b6d4';
          } else if (node.group === 'category') {
            ctx.shadowColor = '#a855f7'; // Purple
            ctx.fillStyle = '#a855f7';
          } else {
            ctx.shadowColor = 'rgba(255,255,255,0.4)';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          }
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(80, 80, 100, 0.25)';
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Node outline
        ctx.strokeStyle = isDimmed ? 'rgba(255,255,255,0.02)' : 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Node labels - show labels for companies, categories, selected/hovered nodes, and their connected neighbors
        const isSearchMatch = searchQuery && node.label?.toLowerCase().includes(searchQuery.toLowerCase());
        const showLabel = 
          node.group === 'company' || 
          node.group === 'category' || 
          node === activeNode || 
          (activeNode && activeNode.group === 'category' && node.group === 'risk' && connectedNodes.has(node.id)) ||
          isSearchMatch;
        
        if (showLabel && node.label) {
          ctx.fillStyle = isDimmed ? 'rgba(100,100,120,0.3)' : isSearchMatch ? '#22d3ee' : '#e2e8f0';
          ctx.font = node.group === 'company' ? 'bold 12px sans-serif' : '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(node.label, node.x, node.y - radius - 6);
        }
      }

      animationRef.current = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [graphData, searchQuery]);

  // Canvas Mouse events helper
  const getMouseCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getMouseCoords(e);
    const nodes = nodesRef.current;

    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    isDraggingNodeRef.current = false;

    // Check if clicked a node
    let clickedNode: VisualNode | null = null;
    for (const node of nodes) {
      const radius = node.val / 1.5 + 4;
      const dx = node.x - x;
      const dy = node.y - y;
      if (dx * dx + dy * dy < (radius + 6) * (radius + 6)) {
        clickedNode = node;
        break;
      }
    }

    if (clickedNode) {
      draggedNodeRef.current = clickedNode;
      // Do NOT set fx/fy or alphaRef.current here yet to prevent click jitter
    } else {
      isDraggingCanvasRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getMouseCoords(e);

    // Handle node drag
    const draggedNode = draggedNodeRef.current;
    if (draggedNode) {
      const startX = mouseDownPosRef.current.x;
      const startY = mouseDownPosRef.current.y;
      const moveX = e.clientX - startX;
      const moveY = e.clientY - startY;
      const dragDistance = Math.sqrt(moveX * moveX + moveY * moveY);

      // 3px drag threshold
      if (dragDistance > 3 || isDraggingNodeRef.current) {
        isDraggingNodeRef.current = true;
        draggedNode.x = x;
        draggedNode.y = y;
        draggedNode.fx = x;
        draggedNode.fy = y;
        alphaRef.current = 0.8; // Re-heat physics simulation for dragging
      }
      return;
    }

    // Handle hover detection (only when not dragging)
    let foundHover: VisualNode | null = null;
    if (!isDraggingCanvasRef.current) {
      const nodes = nodesRef.current;
      for (const node of nodes) {
        const radius = node.val / 1.5 + 4;
        const dx = node.x - x;
        const dy = node.y - y;
        if (dx * dx + dy * dy < (radius + 6) * (radius + 6)) {
          foundHover = node;
          break;
        }
      }
    }
    hoveredNodeRef.current = foundHover;
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const draggedNode = draggedNodeRef.current;
    if (draggedNode) {
      draggedNode.fx = undefined;
      draggedNode.fy = undefined;
      
      // If released immediately without dragging, treat it as a click
      if (!isDraggingNodeRef.current) {
        // Toggle selected node state
        if (selectedNodeRef.current?.id === draggedNode.id) {
          selectedNodeRef.current = null;
          setSelectedNodeState(null);
        } else {
          selectedNodeRef.current = draggedNode;
          setSelectedNodeState(draggedNode);
        }
      }
      
      draggedNodeRef.current = null;
    }
    isDraggingCanvasRef.current = false;
    isDraggingNodeRef.current = false;
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white tracking-tight">Risk Explorer Graph</h2>
        <p className="text-sm text-slate-400">
          Visualize risk vectors programmatically. Nodes mapping companies (Cyan), threat categories (Purple), and specific disclosures (White) represent index relations. Click any node to select it and review detailed context in the sidebar.
        </p>
      </div>

      {/* Control bar */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 glass-panel rounded-2xl">
        {/* Company filter dropdown */}
        <div className="space-y-1">
          <span className="text-[10px] text-brand-purple uppercase tracking-wider font-bold">Filter Entity</span>
          <div>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="bg-black/60 border border-glass px-4 py-2 rounded-xl text-white font-semibold text-sm focus:outline-none focus:border-brand-purple/50 cursor-pointer"
            >
              <option value="">Global Network Graph</option>
              {companies.map((c, idx) => (
                <option key={idx} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Node search bar */}
        <div className="flex-1 space-y-1">
          <span className="text-[10px] text-brand-blue uppercase tracking-wider font-bold">Search Nodes</span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Highlight node labels (e.g. GPU, tariff, litigation)"
              className="w-full bg-black/50 border border-glass pl-9 pr-4 py-1.5 rounded-xl text-slate-300 focus:outline-none focus:border-brand-purple/50 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Canvas & Details Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Graph Canvas */}
        <div className="lg:col-span-3 glass-panel p-2 rounded-3xl relative border border-glass overflow-hidden shadow-2xl min-h-[600px]">
          {loading && (
            <div className="absolute inset-0 z-20 bg-black/60 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-brand-purple animate-spin" />
              <p className="text-xs text-slate-400 italic">Simulating node vectors...</p>
            </div>
          )}

          {error && !loading && (
            <div className="p-20 text-center text-slate-500 text-sm">
              {error}
            </div>
          )}

          {!error && (
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className="w-full h-[600px] cursor-grab active:cursor-grabbing block rounded-2xl"
            />
          )}

          {/* Floating Legend */}
          {!error && !loading && (
            <div className="absolute bottom-4 left-4 p-3 bg-black/75 border border-glass rounded-xl text-[10px] space-y-2 select-none pointer-events-none">
              <div className="font-bold text-slate-400 uppercase tracking-wider mb-1">Graph Legend</div>
              <div className="flex items-center gap-2 text-slate-300">
                <div className="w-2.5 h-2.5 rounded-full bg-brand-blue shadow-[0_0_8px_#06b6d4]"></div>
                <span className="font-semibold">Company Entity</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <div className="w-2.5 h-2.5 rounded-full bg-brand-purple shadow-[0_0_8px_#a855f7]"></div>
                <span className="font-semibold">Risk Category</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shadow-[0_0_5px_rgba(255,255,255,0.4)] ml-0.5"></div>
                <span className="font-semibold">SEC Disclosure Passage (Click to Select)</span>
              </div>
            </div>
          )}
        </div>

        {/* Selected Node Details Sidebar */}
        <div className="lg:col-span-1 flex flex-col h-full">
          {selectedNode ? (
            <div className="glass-panel p-5 rounded-3xl border border-glow-purple/20 bg-gradient-to-b from-[#1c123f]/25 to-transparent space-y-5 flex-1 flex flex-col justify-between min-h-[600px]">
              <div className="space-y-4">
                <div className="border-b border-glass pb-3">
                  <span className="text-[9px] px-2 py-0.5 font-bold uppercase tracking-wider bg-brand-purple/10 border border-brand-purple/20 text-brand-neon-purple rounded">
                    {selectedNode.group} Node
                  </span>
                  <h3 className="font-bold text-white text-sm mt-2 leading-tight">
                    {selectedNode.group === 'risk' ? 'SEC Disclosure Passage' : selectedNode.label}
                  </h3>
                </div>

                {selectedNode.group === 'risk' ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-[9px]">
                      <div className="bg-white/5 p-2 rounded-lg">
                        <span className="text-slate-400 block uppercase font-bold text-[8px]">Filer</span>
                        <span className="text-white font-semibold">{selectedNode.company}</span>
                      </div>
                      <div className="bg-white/5 p-2 rounded-lg">
                        <span className="text-slate-400 block uppercase font-bold text-[8px]">Filing Year</span>
                        <span className="text-white font-semibold">{selectedNode.year || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Document Details</span>
                      <span className="text-xs text-slate-300 block">
                        Source: <span className="text-slate-400 underline font-mono text-[9px] break-all">{selectedNode.source}</span> (Page {selectedNode.page})
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Filing Excerpt</span>
                      <div className="bg-black/40 border border-glass p-3 rounded-xl max-h-[260px] overflow-y-auto text-xs text-slate-300 leading-relaxed font-sans scrollbar-thin">
                        "{selectedNode.description}"
                      </div>
                    </div>
                  </div>
                ) : selectedNode.group === 'company' ? (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Entity node representing <strong>{selectedNode.label}</strong>. All indexed risk segments are clustered around this parent node.
                    </p>
                    <div className="bg-white/5 p-3 rounded-lg text-xs">
                      <span className="text-slate-400 uppercase font-bold text-[9px] block">Entity Control Status</span>
                      <span className="text-white mt-1 block">Active & Indexed in Vector database.</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Category node representing <strong>{selectedNode.label}</strong>. Risk factors containing keywords related to this category are connected here.
                    </p>
                  </div>
                )}
              </div>

              {selectedNode.group === 'risk' && (
                <button
                  onClick={() => setExplainingRisk(selectedNode)}
                  className="w-full py-2.5 bg-gradient-to-r from-brand-purple to-violet-600 hover:from-brand-purple-dark hover:to-violet-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-glow-purple/10 transition-all cursor-pointer border-none"
                >
                  <Brain className="w-3.5 h-3.5" />
                  <span>Explain with RiskLens AI</span>
                </button>
              )}
              
              {selectedNode.group === 'company' && selectedCompany !== selectedNode.id && (
                <button
                  onClick={() => setSelectedCompany(selectedNode.id)}
                  className="w-full py-2.5 bg-gradient-to-r from-brand-blue to-cyan-600 hover:from-brand-blue-dark hover:to-cyan-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-glow-blue/10 transition-all cursor-pointer border-none"
                >
                  <span>Filter Workspace to {selectedNode.id}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="glass-panel p-6 rounded-3xl border border-glass text-center text-slate-500 text-xs py-20 flex-1 flex flex-col justify-center items-center space-y-3 select-none min-h-[600px]">
              <Network className="w-8 h-8 text-slate-600 animate-pulse" />
              <div className="space-y-1">
                <p className="font-semibold text-slate-400 text-xs">No Node Selected</p>
                <p className="text-[10px] text-slate-500 max-w-[150px] mx-auto">
                  Click any node in the graph to view properties and context details.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Explainer Sidebar */}
      <RiskExplanationModal
        isOpen={explainingRisk !== null}
        riskTitle={explainingRisk?.label || 'Selected Risk'}
        context={explainingRisk?.description || ''}
        onClose={() => setExplainingRisk(null)}
      />
    </div>
  );
};
