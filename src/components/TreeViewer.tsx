import React, { useState, useRef, useMemo } from 'react';
import {
  Person,
  Relationship,
  RelationshipType
} from '../types/genealogy';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  List,
  Info,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Search
} from 'lucide-react';
import { TreeListAlternative } from './TreeListAlternative';

interface TreeViewerProps {
  people: Person[];
  relationships: Relationship[];
  onSelectPerson: (person: Person) => void;
  onAddRelationship?: () => void;
  onAddPerson?: () => void;
}

interface TreeNodeLayout {
  person: Person;
  x: number;
  y: number;
  width: number;
  height: number;
  generation: number;
  children: TreeNodeLayout[];
  partners: Person[];
}

export const TreeViewer: React.FC<TreeViewerProps> = ({
  people,
  relationships,
  onSelectPerson,
}) => {
  const [viewMode, setViewMode] = useState<'svg' | 'list'>('svg');
  const [selectedRootId, setSelectedRootId] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState('');
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());

  // Transform / Zoom / Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Map people by ID for rapid lookup
  const peopleMap = useMemo(() => {
    const map = new Map<string, Person>();
    for (const p of people) map.set(p.id, p);
    return map;
  }, [people]);

  // Map parents to children
  const parentToChildrenMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of relationships) {
      if (r.type === 'parent_child' || r.type === 'other_source_statement') {
        const list = map.get(r.fromPersonId) || [];
        if (!list.includes(r.toPersonId)) {
          list.push(r.toPersonId);
          map.set(r.fromPersonId, list);
        }
      }
    }
    return map;
  }, [relationships]);

  // Map partners/unions
  const partnerMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of relationships) {
      if (r.type === 'partner_or_union') {
        const l1 = map.get(r.fromPersonId) || [];
        if (!l1.includes(r.toPersonId)) map.set(r.fromPersonId, [...l1, r.toPersonId]);
        const l2 = map.get(r.toPersonId) || [];
        if (!l2.includes(r.fromPersonId)) map.set(r.toPersonId, [...l2, r.fromPersonId]);
      }
    }
    return map;
  }, [relationships]);

  // Determine available root choices
  const candidateRoots = useMemo(() => {
    // People who are not children of anyone in parent_child relationships, or explicitly named Patriarch
    const childIds = new Set<string>();
    for (const r of relationships) {
      if (r.type === 'parent_child') childIds.add(r.toPersonId);
    }
    const roots = people.filter((p) => !childIds.has(p.id));
    return roots.length > 0 ? roots : people.slice(0, 10);
  }, [people, relationships]);

  // Default root
  const activeRootId = useMemo(() => {
    if (selectedRootId && peopleMap.has(selectedRootId)) {
      return selectedRootId;
    }
    // Prefer person with "ከንቲባ ጉዕሽ" in name or first root
    const patriarch = candidateRoots.find((p) => p.canonicalName.includes('ከንቲባ ጉዕሽ') || p.canonicalName.includes('ከንቲባ ጉዑሽ') || p.id.includes('root'));
    if (patriarch) return patriarch.id;
    return candidateRoots[0]?.id || people[0]?.id || '';
  }, [selectedRootId, candidateRoots, peopleMap, people]);

  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Build Layout Tree recursively
  const layoutData = useMemo(() => {
    if (!activeRootId || !peopleMap.has(activeRootId)) return null;

    const NODE_WIDTH = 220;
    const NODE_HEIGHT = 90;
    const HORIZONTAL_GAP = 30;
    const VERTICAL_GAP = 90;

    let currentX = 50;

    const buildSubtree = (personId: string, gen: number, visited: Set<string>): TreeNodeLayout | null => {
      if (visited.has(personId)) return null;
      visited.add(personId);

      const person = peopleMap.get(personId);
      if (!person) return null;

      const isCollapsed = collapsedNodeIds.has(personId);
      const childIds = isCollapsed ? [] : (parentToChildrenMap.get(personId) || []);

      const childrenNodes: TreeNodeLayout[] = [];
      for (const cId of childIds) {
        const childNode = buildSubtree(cId, gen + 1, new Set(visited));
        if (childNode) childrenNodes.push(childNode);
      }

      // Partner people
      const partnerIds = partnerMap.get(personId) || [];
      const partners = partnerIds.map((id) => peopleMap.get(id)!).filter(Boolean);

      // Node coordinates
      let nodeX = currentX;
      if (childrenNodes.length > 0) {
        const firstChildX = childrenNodes[0].x;
        const lastChildX = childrenNodes[childrenNodes.length - 1].x;
        nodeX = (firstChildX + lastChildX) / 2;
      } else {
        currentX += NODE_WIDTH + HORIZONTAL_GAP;
      }

      const nodeY = 50 + gen * (NODE_HEIGHT + VERTICAL_GAP);

      return {
        person,
        x: nodeX,
        y: nodeY,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        generation: gen,
        children: childrenNodes,
        partners,
      };
    };

    const tree = buildSubtree(activeRootId, 0, new Set());
    return tree;
  }, [activeRootId, peopleMap, parentToChildrenMap, partnerMap, collapsedNodeIds]);

  // Flatten nodes and connections for SVG rendering
  const { renderedNodes, renderedLinks } = useMemo(() => {
    const nodes: TreeNodeLayout[] = [];
    const links: {
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      type: RelationshipType;
      status: string;
      label?: string;
    }[] = [];

    const traverse = (node: TreeNodeLayout) => {
      nodes.push(node);
      for (const child of node.children) {
        // Find relationship metadata
        const rel = relationships.find(
          (r) => r.fromPersonId === node.person.id && r.toPersonId === child.person.id
        );

        links.push({
          fromX: node.x + node.width / 2,
          fromY: node.y + node.height,
          toX: child.x + child.width / 2,
          toY: child.y,
          type: rel?.type || 'parent_child',
          status: rel?.status || 'verified',
          label: rel?.type === 'other_source_statement' ? 'Source statement' : undefined,
        });

        traverse(child);
      }
    };

    if (layoutData) traverse(layoutData);
    return { renderedNodes: nodes, renderedLinks: links };
  }, [layoutData, relationships]);

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Zoom helpers
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.15, 2.5));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.15, 0.3));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 50, y: 50 });
  };
  const handleFitToView = () => {
    if (!renderedNodes.length) return;
    setZoom(0.75);
    setPan({ x: 100, y: 30 });
  };

  if (people.length === 0) {
    return (
      <div className="text-center py-16 px-4 bg-white rounded-xl shadow-sm border border-stone-200">
        <Sparkles className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-stone-800">No Family Records Yet</h3>
        <p className="text-sm text-stone-500 max-w-md mx-auto mt-1">
          You can run a staged import from the source files or load demo records to preview the interactive tree.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] bg-stone-100/70 border border-stone-300/80 rounded-xl overflow-hidden shadow-inner">
      {/* Top Tree Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border-b border-stone-200 z-10 text-stone-700">
        <div className="flex items-center space-x-2">
          <label htmlFor="root-select" className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Root:
          </label>
          <select
            id="root-select"
            value={activeRootId}
            onChange={(e) => setSelectedRootId(e.target.value)}
            className="text-xs sm:text-sm font-ethiopic py-1.5 px-2.5 rounded-lg border border-stone-300 bg-stone-50 text-stone-800 focus:ring-2 focus:ring-amber-500 font-medium"
          >
            {candidateRoots.map((r) => (
              <option key={r.id} value={r.id}>
                {r.canonicalName} {r.branch ? `(${r.branch})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Zoom & View Switcher */}
        <div className="flex items-center space-x-1.5">
          <div className="bg-stone-100 rounded-lg p-0.5 border border-stone-300 flex items-center space-x-0.5">
            <button
              onClick={handleZoomIn}
              className="p-1.5 hover:bg-white rounded text-stone-600 hover:text-stone-900 transition-colors"
              title="Zoom In"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1.5 hover:bg-white rounded text-stone-600 hover:text-stone-900 transition-colors"
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1.5 hover:bg-white rounded text-stone-600 hover:text-stone-900 text-xs px-2 font-mono"
              title="Reset Zoom to 100%"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={handleFitToView}
              className="p-1.5 hover:bg-white rounded text-stone-600 hover:text-stone-900 transition-colors"
              title="Fit to View"
              aria-label="Fit to View"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setViewMode(viewMode === 'svg' ? 'list' : 'svg')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors border ${
              viewMode === 'list'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white hover:bg-stone-50 text-stone-700 border-stone-300'
            }`}
            title="Accessible List View Alternative for Screen Readers"
          >
            <List className="w-3.5 h-3.5" />
            <span>{viewMode === 'list' ? 'Switch to Graphical Tree' : 'Accessible List Alternative'}</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'list' ? (
        <div className="flex-1 overflow-y-auto p-4 bg-white">
          <TreeListAlternative
            people={people}
            relationships={relationships}
            onSelectPerson={onSelectPerson}
            rootId={activeRootId}
          />
        </div>
      ) : (
        <div
          className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* SVG Canvas */}
          <svg
            ref={svgRef}
            className="w-full h-full"
            style={{ touchAction: 'none' }}
          >
            <defs>
              {/* Pattern for background parchment grid */}
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e7e5e4" strokeWidth="0.8" />
              </pattern>

              {/* Arrow marker */}
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#78716c" />
              </marker>
            </defs>

            <rect width="100%" height="100%" fill="url(#grid)" />

            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Render Relationship Connection Lines */}
              {renderedLinks.map((link, idx) => {
                // Curved Bezier path from parent bottom to child top
                const midY = (link.fromY + link.toY) / 2;
                const pathData = `M ${link.fromX} ${link.fromY} C ${link.fromX} ${midY}, ${link.toX} ${midY}, ${link.toX} ${link.toY}`;

                let strokeColor = '#44403c'; // Dark stone for verified
                let strokeDash = 'none';
                let strokeWidth = 2;

                if (link.status === 'needs_review') {
                  strokeColor = '#d97706'; // Amber for needs_review
                  strokeDash = '6,4';
                } else if (link.type === 'other_source_statement') {
                  strokeColor = '#6366f1'; // Indigo for other source statement
                  strokeDash = '3,3';
                }

                return (
                  <g key={`link_${idx}`}>
                    <path
                      d={pathData}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDash}
                      className="transition-all duration-200"
                    />
                    {link.status === 'needs_review' && (
                      <circle
                        cx={(link.fromX + link.toX) / 2}
                        cy={midY}
                        r="4"
                        fill="#f59e0b"
                      />
                    )}
                  </g>
                );
              })}

              {/* Render Tree Nodes */}
              {renderedNodes.map((node) => {
                const isSelectedRoot = node.person.id === activeRootId;
                const hasChildren = (parentToChildrenMap.get(node.person.id) || []).length > 0;
                const isCollapsed = collapsedNodeIds.has(node.person.id);

                let borderColor = 'border-stone-300';
                let bgColor = 'bg-white';
                let statusBadge = null;

                if (node.person.status === 'needs_review') {
                  borderColor = 'border-amber-400';
                  bgColor = 'bg-amber-50/50';
                  statusBadge = (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 font-ethiopic">
                      ምምርማር ዘድልዮ
                    </span>
                  );
                } else if (node.person.status === 'verified') {
                  statusBadge = (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 font-ethiopic">
                      ዝተረጋገጸ
                    </span>
                  );
                }

                return (
                  <g
                    key={node.person.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    className="cursor-pointer group"
                    onClick={(e) => {
                      if (hasChildren) {
                        toggleCollapse(node.person.id, e);
                      } else {
                        onSelectPerson(node.person);
                      }
                    }}
                  >
                    <foreignObject width={node.width} height={node.height}>
                      <div
                        className={`h-full w-full rounded-xl border-2 ${
                          isSelectedRoot ? 'border-amber-600 ring-2 ring-amber-400/50 shadow-md' : borderColor
                        } ${bgColor} shadow-sm hover:shadow-md transition-all p-2.5 flex flex-col justify-between text-left`}
                      >
                        {/* Header: Status */}
                        <div className="flex items-center justify-between text-[11px] text-stone-500">
                          <div className="flex items-center space-x-1">
                            {statusBadge}
                          </div>
                        </div>

                        {/* Name (Ethiopic) */}
                        <div>
                          <h4 className="font-bold text-sm sm:text-base text-stone-900 font-ethiopic leading-snug line-clamp-1">
                            {node.person.canonicalName}
                          </h4>
                          {node.person.branch && (
                            <p className="text-[11px] text-stone-500 line-clamp-1 font-ethiopic">
                              {node.person.branch}
                            </p>
                          )}
                        </div>

                        {/* Footer: branch and collapse toggle */}
                        <div className="flex items-center justify-between text-[10px] text-stone-400 pt-0.5 border-t border-stone-100 font-ethiopic">
                          <span className="truncate max-w-[120px]">
                            {node.children.length > 0 ? `${node.children.length} ውሉዳት` : ''}
                          </span>

                          {hasChildren && (
                            <button
                              onClick={(e) => toggleCollapse(node.person.id, e)}
                              className="px-1.5 py-0.5 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center space-x-0.5 text-[10px]"
                              title={isCollapsed ? 'ውሉዳት ኣርእይ' : 'ውሉዳት ሕባእ'}
                            >
                              {isCollapsed ? (
                                <>
                                  <ChevronRight className="w-3 h-3" />
                                  <span>ዘርግሕ</span>
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3 h-3" />
                                  <span>ዓጽፍ</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Visual Legend Overlay */}
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm p-2.5 rounded-xl border border-stone-300 text-xs text-stone-700 shadow-sm max-w-xs font-ethiopic">
            <p className="font-bold text-stone-900 mb-1.5 flex items-center">
              <Info className="w-3.5 h-3.5 mr-1 text-amber-700" />
              <span>መረዳእታ መስመራት ወለዶ</span>
            </p>
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center space-x-2">
                <span className="w-5 h-0.5 bg-stone-800 inline-block"></span>
                <span>ዝተረጋገጸ ዝምድና ወላድን ውሉድን</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-5 h-0.5 border-t border-dashed border-amber-600 inline-block"></span>
                <span className="text-amber-800">ምምርማር ዘድልዮ ዝምድና</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-5 h-0.5 border-t border-dotted border-indigo-600 inline-block"></span>
                <span className="text-indigo-800">ናይ ጨንፈር ሓበሬታ</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

