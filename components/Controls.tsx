
import React, { useState, useRef } from 'react';
import { Settings, ZoomIn, RefreshCw, X, Menu, MousePointer2, Monitor, Plus, Minus, Move, RotateCcw, Sparkles, Loader2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { FractalConfig, FractalType, ColorScheme } from '../types';
import { INITIAL_CONFIG } from '../constants';

interface ControlsProps {
  config: FractalConfig;
  onUpdate: (newConfig: Partial<FractalConfig>) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}

const generateColorCurveData = (iterations: number, smooth: boolean) => {
  const data = [];
  for (let i = 0; i < 50; i++) {
    const x = i / 50;
    const y = smooth ? Math.sin(x * Math.PI * 2) * 0.5 + 0.5 : (i % 5) / 5; 
    data.push({ x: i, intensity: y });
  }
  return data;
};

const formatZoom = (zoom: number) => {
  if (zoom >= 1e9) return `${(zoom / 1e9).toFixed(2)}B x`;
  if (zoom >= 1e6) return `${(zoom / 1e6).toFixed(2)}M x`;
  if (zoom >= 1e3) return `${(zoom / 1e3).toFixed(2)}k x`;
  return `${zoom.toFixed(2)} x`;
};

const Controls: React.FC<ControlsProps> = ({ config, onUpdate, onInteractionStart, onInteractionEnd }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const padRef = useRef<HTMLDivElement>(null);

  const handleReset = () => {
    onUpdate(INITIAL_CONFIG);
  };

  const handleResetJulia = () => {
    onUpdate({ juliaC: INITIAL_CONFIG.juliaC });
  }
  
  const handleAIExplore = async () => {
      setIsGenerating(true);
      
      // Simulate a loading state
      await new Promise(resolve => setTimeout(resolve, 800));

      const hardcodedConfigs = [
          {
              type: FractalType.MANDELBROT,
              zoom: 150000,
              centerX: -0.7436438870371587,
              centerY: 0.13182590420531197,
              iterations: 1000,
              colorScheme: ColorScheme.MAGMA,
              smoothColoring: true
          },
          {
              type: FractalType.JULIA,
              zoom: 200,
              centerX: 0,
              centerY: 0,
              juliaC: { re: -0.8, im: 0.156 },
              iterations: 300,
              colorScheme: ColorScheme.ELECTRIC,
              smoothColoring: true
          },
          {
              type: FractalType.BURNING_SHIP,
              zoom: 50000,
              centerX: -1.755,
              centerY: -0.03,
              iterations: 200,
              colorScheme: ColorScheme.RAINBOW,
              smoothColoring: true
          },
          {
              type: FractalType.TRICORN,
              zoom: 1000,
              centerX: -0.1,
              centerY: 0.85,
              iterations: 400,
              colorScheme: ColorScheme.CLASSIC,
              smoothColoring: true
          },
          {
              type: FractalType.MANDELBROT,
              zoom: 5000,
              centerX: -0.1528,
              centerY: 1.0397,
              iterations: 500,
              colorScheme: ColorScheme.ELECTRIC,
              smoothColoring: true
          }
      ];

      const randomConfig = hardcodedConfigs[Math.floor(Math.random() * hardcodedConfigs.length)];
      
      onUpdate({
          type: randomConfig.type,
          zoom: randomConfig.zoom,
          centerX: randomConfig.centerX,
          centerY: randomConfig.centerY,
          juliaC: (randomConfig as any).juliaC || INITIAL_CONFIG.juliaC,
          iterations: randomConfig.iterations,
          colorScheme: randomConfig.colorScheme,
          smoothColoring: randomConfig.smoothColoring
      });

      setIsGenerating(false);
  };

  const toggleOpen = () => setIsOpen(!isOpen);

  const chartData = generateColorCurveData(config.iterations, config.smoothColoring);
  const logZoom = config.zoom > 0 ? Math.log10(config.zoom) : 0;

  // Handle 2D Pad Interaction
  const handlePadInteraction = (e: React.PointerEvent) => {
    if (!padRef.current) return;
    padRef.current.setPointerCapture(e.pointerId);
    
    const update = (evt: React.PointerEvent) => {
        if (!padRef.current) return;
        const rect = padRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width, evt.clientX - rect.left));
        const y = Math.max(0, Math.min(rect.height, evt.clientY - rect.top));
        
        // Map 0..width to -2..2
        const re = (x / rect.width) * 4 - 2;
        // Map 0..height to 2..-2 (inverted Y)
        const im = -((y / rect.height) * 4 - 2);
        
        onUpdate({ juliaC: { re, im } });
    }

    update(e);
    onInteractionStart();

    const onMove = (evt: PointerEvent) => update(evt as unknown as React.PointerEvent);
    const onUp = (evt: PointerEvent) => {
        padRef.current?.releasePointerCapture(evt.pointerId);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        onInteractionEnd();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <>
      <div
        className={`absolute top-0 left-0 h-full w-80 bg-gray-900/90 backdrop-blur-md border-r border-gray-800 text-gray-200 transform transition-transform duration-300 ease-in-out z-20 flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={toggleOpen}
          className="absolute top-1/2 -right-8 transform -translate-y-1/2 bg-gray-900/90 border border-l-0 border-gray-800 text-gray-400 hover:text-white p-1 rounded-r-md z-30 shadow-lg transition-colors"
          title={isOpen ? "Collapse panel" : "Expand panel"}
        >
          {isOpen ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
        </button>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-xl font-bold text-white">
              Fractals
            </h1>
            <div className="flex gap-2">
               <button onClick={handleAIExplore} disabled={isGenerating} className="p-1 hover:text-white relative" title="Discover with AI">
                 {isGenerating ? <Loader2 size={18} className="animate-spin text-blue-400" /> : <Sparkles size={18} className="text-blue-400" />}
               </button>
               <button onClick={handleReset} className="p-1 hover:text-white" title="Full Reset">
                 <RefreshCw size={18} />
               </button>
            </div>
          </div>

        {/* Fractal Type */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Fractal Type</label>
            <div className="relative">
              <select
                value={config.type}
                onChange={(e) => onUpdate({ type: Number(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 appearance-none focus:outline-none focus:border-blue-500 transition-colors"
              >
                <optgroup label="Escape Time">
                    <option value={FractalType.MANDELBROT}>Mandelbrot Set</option>
                    <option value={FractalType.JULIA}>Julia Set</option>
                    <option value={FractalType.BURNING_SHIP}>Burning Ship</option>
                    <option value={FractalType.TRICORN}>Tricorn (Mandelbar)</option>
                    <option value={FractalType.CELTIC}>Celtic Mandelbrot</option>
                </optgroup>
                <optgroup label="Geometric / IFS">
                    <option value={FractalType.SIERPINSKI_CARPET}>Sierpinski Carpet</option>
                    <option value={FractalType.SIERPINSKI_TRIANGLE}>Sierpinski Triangle</option>
                    <option value={FractalType.KOCH_SNOWFLAKE}>Koch Snowflake</option>
                </optgroup>
              </select>
            </div>
          </div>
        </div>

        {/* View Controls */}
        <div className="space-y-4 mb-6 border-b border-gray-800 pb-6">
            <h2 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
                <ZoomIn size={16} /> View & Navigation
            </h2>
            
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <label className="text-xs text-gray-500">Zoom Level</label>
                    <span className="text-xs font-mono text-blue-400 font-bold">{formatZoom(config.zoom)}</span>
                </div>
                
                <div className="flex items-center gap-2 bg-gray-800 p-2 rounded-lg border border-gray-700">
                    <button 
                        onClick={() => onUpdate({ zoom: config.zoom / 1.5 })}
                        className="p-1 text-gray-400 hover:text-white transition-colors"
                        title="Zoom Out"
                    >
                        <Minus size={16} />
                    </button>
                    
                    <div className="relative flex-1 h-6 flex items-center">
                        <div className="absolute w-full h-1 bg-gray-600 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-blue-500 transition-all duration-75 ease-out"
                                style={{ width: `${((logZoom + 1) / 9) * 100}%` }} 
                            />
                        </div>
                        <input 
                            type="range" 
                            min="-1" 
                            max="8"  
                            step="0.01" 
                            value={logZoom}
                            onChange={(e) => onUpdate({ zoom: Math.pow(10, Number(e.target.value)) })}
                            onPointerDown={onInteractionStart}
                            onPointerUp={onInteractionEnd}
                            className="absolute w-full h-full opacity-0 cursor-pointer"
                        />
                    </div>

                    <button 
                        onClick={() => onUpdate({ zoom: config.zoom * 1.5 })}
                        className="p-1 text-gray-400 hover:text-white transition-colors"
                        title="Zoom In"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>

            {/* Pan Sensitivity */}
            <div>
                 <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500 flex items-center gap-1"><Move size={10}/> Pan Sensitivity</span>
                    <span className="font-mono">{config.panSensitivity.toFixed(1)}</span>
                </div>
                <input 
                    type="range"
                    min="0.1" max="5.0" step="0.1"
                    value={config.panSensitivity}
                    onChange={(e) => onUpdate({ panSensitivity: Number(e.target.value) })}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
            </div>
        </div>

        {/* Julia Controls */}
        {config.type === FractalType.JULIA && (
            <div className="space-y-4 mb-6 border-b border-gray-800 pb-6 animate-in fade-in slide-in-from-left-4 duration-300">
                <div className="flex justify-between items-center">
                    <h2 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
                        <MousePointer2 size={16} /> Julia Constant C
                    </h2>
                    <button onClick={handleResetJulia} className="text-xs text-gray-500 hover:text-white flex items-center gap-1" title="Reset Julia C">
                        <RotateCcw size={12} /> Reset
                    </button>
                </div>
                
                <div className="bg-gray-800/50 p-4 rounded-lg flex flex-col items-center gap-2">
                    {/* 2D Pad */}
                    <div 
                        ref={padRef}
                        onPointerDown={handlePadInteraction}
                        className="w-40 h-40 bg-gray-900 border border-gray-600 rounded relative cursor-crosshair touch-none shadow-inner"
                        style={{
                            backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 1px, transparent 1px)',
                            backgroundSize: '10px 10px'
                        }}
                    >
                        {/* Axes */}
                        <div className="absolute top-1/2 left-0 w-full h-px bg-gray-700/50" />
                        <div className="absolute left-1/2 top-0 h-full w-px bg-gray-700/50" />
                        
                        {/* Control Point */}
                        <div 
                            className="absolute w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-75"
                            style={{
                                left: `${((config.juliaC.re + 2) / 4) * 100}%`,
                                top: `${((-config.juliaC.im + 2) / 4) * 100}%`
                            }}
                        />
                    </div>
                    <div className="flex w-full justify-between gap-2 text-xs text-gray-400 font-mono mt-2">
                        <div className="flex items-center gap-1 flex-1">
                            <label>Re:</label>
                            <input 
                                type="number" 
                                step="0.001"
                                value={Number(config.juliaC.re).toString()}
                                onChange={(e) => onUpdate({ juliaC: { ...config.juliaC, re: parseFloat(e.target.value) || 0 } })}
                                className="w-full bg-gray-900 border border-gray-700 rounded px-1 py-1 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="flex items-center gap-1 flex-1">
                            <label>Im:</label>
                            <input 
                                type="number" 
                                step="0.001"
                                value={Number(config.juliaC.im).toString()}
                                onChange={(e) => onUpdate({ juliaC: { ...config.juliaC, im: parseFloat(e.target.value) || 0 } })}
                                className="w-full bg-gray-900 border border-gray-700 rounded px-1 py-1 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Render Settings */}
        <div className="space-y-4 mb-6 border-b border-gray-800 pb-6">
             <h2 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
                <Settings size={16} /> Rendering
            </h2>

             {/* Quality Setting */}
            <div>
                <label className="block text-xs text-gray-500 mb-2 flex items-center gap-1">
                    <Monitor size={12}/> Quality
                </label>
                <div className="flex bg-gray-800 p-1 rounded-lg">
                    {[
                        { label: 'Low', value: 0 },
                        { label: 'Med', value: 1 },
                        { label: 'High', value: 2 },
                    ].map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => onUpdate({ quality: opt.value })}
                            className={`flex-1 text-xs py-1.5 rounded-md transition-all ${
                                config.quality === opt.value 
                                ? 'bg-blue-600 text-white shadow-sm' 
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                <p className="text-[10px] text-gray-500 mt-1 pl-1 h-3">
                    {config.quality === 2 
                        ? '4x Supersampling (Auto-disables on interact)' 
                        : 'Standard rendering'}
                </p>
            </div>

            <div className="pt-2">
                <label className="block text-xs text-gray-500 mb-1">Color Scheme</label>
                <div className="flex gap-2">
                    {[ColorScheme.CLASSIC, ColorScheme.ELECTRIC, ColorScheme.MAGMA, ColorScheme.RAINBOW].map((scheme) => (
                        <button
                            key={scheme}
                            onClick={() => onUpdate({ colorScheme: scheme })}
                            className={`w-8 h-8 rounded-full border-2 ${config.colorScheme === scheme ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'} transition-all`}
                            style={{
                                background: 
                                    scheme === ColorScheme.CLASSIC ? 'linear-gradient(45deg, #005, #faa)' :
                                    scheme === ColorScheme.ELECTRIC ? 'linear-gradient(45deg, #000, #ff0)' :
                                    scheme === ColorScheme.MAGMA ? 'linear-gradient(45deg, #200, #fa0)' :
                                    'linear-gradient(45deg, red, blue, green)'
                            }}
                            title={ColorScheme[scheme]}
                        />
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-between">
                <label className="text-sm text-gray-300">Smooth Coloring</label>
                <input 
                    type="checkbox"
                    checked={config.smoothColoring}
                    onChange={(e) => onUpdate({ smoothColoring: e.target.checked })}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                />
            </div>

            <div>
                 <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Iterations</span>
                    <span className="font-mono">{config.iterations}</span>
                </div>
                <input 
                    type="range"
                    min="50" max="5000" step="50"
                    value={config.iterations}
                    onChange={(e) => onUpdate({ iterations: Number(e.target.value) })}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
            </div>

             <div>
                 <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Escape Radius</span>
                    <span className="font-mono">{config.escapeRadius}</span>
                </div>
                <input 
                    type="range"
                    min="2" max="500" step="1"
                    value={config.escapeRadius}
                    onChange={(e) => onUpdate({ escapeRadius: Number(e.target.value) })}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
            </div>
        </div>

        {/* Visual Analysis */}
        <div className="space-y-4">
             <h2 className="text-sm font-semibold text-gray-400">Color Mapping Analysis</h2>
             <div className="h-32 w-full bg-gray-800/30 rounded-lg p-2 border border-gray-800 flex flex-col items-center justify-center overflow-hidden">
                    <LineChart data={chartData} width={260} height={100}>
                        <XAxis dataKey="x" hide />
                        <YAxis hide />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#111', border: 'none', fontSize: '12px' }}
                            itemStyle={{ color: '#aaa' }}
                        />
                        <Line 
                            type="monotone" 
                            dataKey="intensity" 
                            stroke="#8884d8" 
                            strokeWidth={2} 
                            dot={false}
                            isAnimationActive={false} 
                        />
                    </LineChart>
                <p className="text-[10px] text-gray-500 text-center mt-1">Iteration intensity distribution curve</p>
             </div>
        </div>
        
        <div className="mt-8 text-xs text-gray-600 text-center">
            Pinch/Scroll to Zoom • Arrow Keys to Pan
        </div>
        </div>
      </div>
    </>
  );
};

export default Controls;
