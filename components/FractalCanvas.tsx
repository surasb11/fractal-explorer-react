import React, { useRef, useEffect, useCallback, useState } from 'react';
import { FractalConfig } from '../types';
import { VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE } from '../constants';

interface FractalCanvasProps {
  config: FractalConfig;
  onUpdateView: (newConfig: Partial<FractalConfig>) => void;
  isInteracting?: boolean;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

const FractalCanvas: React.FC<FractalCanvasProps> = ({ 
  config, 
  onUpdateView, 
  isInteracting = false,
  onInteractionStart,
  onInteractionEnd
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevTypeRef = useRef(config.type);
  const prevQualityRef = useRef(config.quality);

  // Interaction State
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const touchState = useRef<{ 
    initialDist: number | null;
    initialZoom: number;
    initialCenter: { x: number; y: number };
  }>({ 
    initialDist: null,
    initialZoom: 1,
    initialCenter: { x: 0, y: 0 }
  });
  const configRef = useRef(config); // Ref to access latest config in async loops

  // Update ref when config changes
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Handle Fractal Type or Quality Transition
  useEffect(() => {
    if (prevTypeRef.current !== config.type || prevQualityRef.current !== config.quality) {
      setIsTransitioning(true);
      const timer = setTimeout(() => setIsTransitioning(false), 300);
      prevTypeRef.current = config.type;
      prevQualityRef.current = config.quality;
      return () => clearTimeout(timer);
    }
  }, [config.type, config.quality]);

  // Compile Shader
  const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  // Init WebGL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      alert('WebGL not supported');
      return;
    }
    
    glRef.current = gl as WebGLRenderingContext;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);

    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    programRef.current = program;
    gl.useProgram(program);

    // Fullscreen Quad
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
       1.0,  1.0,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

  }, []);

  // Render Loop
  const render = useCallback(() => {
    const gl = glRef.current;
    const program = programRef.current;
    const canvas = canvasRef.current;

    if (!gl || !program || !canvas) return;

    const displayWidth = canvas.clientWidth * (window.devicePixelRatio || 1);
    const displayHeight = canvas.clientHeight * (window.devicePixelRatio || 1);

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }

    gl.useProgram(program);

    // Uniforms
    const uResolution = gl.getUniformLocation(program, 'u_resolution');
    const uCenter = gl.getUniformLocation(program, 'u_center');
    const uZoom = gl.getUniformLocation(program, 'u_zoom');
    const uType = gl.getUniformLocation(program, 'u_type');
    const uJuliaC = gl.getUniformLocation(program, 'u_juliaC');
    const uIterations = gl.getUniformLocation(program, 'u_iterations');
    const uEscapeRadius = gl.getUniformLocation(program, 'u_escapeRadius');
    const uColorScheme = gl.getUniformLocation(program, 'u_colorScheme');
    const uSmooth = gl.getUniformLocation(program, 'u_smooth');
    const uQuality = gl.getUniformLocation(program, 'u_quality');

    // Downgrade quality during interaction for performance
    const effectiveQuality = isInteracting ? 0 : config.quality;

    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform2f(uCenter, config.centerX, config.centerY);
    gl.uniform1f(uZoom, config.zoom);
    gl.uniform1i(uType, config.type);
    gl.uniform2f(uJuliaC, config.juliaC.re, config.juliaC.im);
    gl.uniform1i(uIterations, config.iterations);
    gl.uniform1f(uEscapeRadius, config.escapeRadius);
    gl.uniform1i(uColorScheme, config.colorScheme);
    gl.uniform1i(uSmooth, config.smoothColoring ? 1 : 0);
    gl.uniform1i(uQuality, effectiveQuality);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, [config, isInteracting]);

  useEffect(() => {
    render();
  }, [render]);

  // Gamepad Polling Loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = 0;

    const pollGamepad = (time: number) => {
        const gamepads = navigator.getGamepads();
        const gp = gamepads[0]; // Primary controller
        
        // Throttling updates to ~30-60fps logic to avoid react state spam if needed, 
        // but smooth movement requires high frequency.
        // We will perform updates directly.

        if (gp && canvasRef.current) {
            const currentConfig = configRef.current;
            const deadzone = 0.1;
            let dx = 0;
            let dy = 0;
            let zoomMult = 1;

            // Left Stick: Pan
            if (Math.abs(gp.axes[0]) > deadzone) dx = gp.axes[0];
            if (Math.abs(gp.axes[1]) > deadzone) dy = -gp.axes[1]; // Up is negative in axes usually, but we want positive Y up

            // Right Stick Y: Zoom
            if (Math.abs(gp.axes[3]) > deadzone) {
                // Up zooms in, Down zooms out
                zoomMult = 1 + (-gp.axes[3] * 0.05);
            }
            
            // L2/R2 (Triggers) for Zoom (Standard mapping: Buttons 6/7)
            const l2 = gp.buttons[6];
            const r2 = gp.buttons[7];
            
            if (l2 && l2.pressed) zoomMult = 1 / (1 + l2.value * 0.05);
            if (r2 && r2.pressed) zoomMult = 1 + r2.value * 0.05;

            // Bumper buttons (RB/LB)
            if (gp.buttons[5].pressed) zoomMult = 1.05; // RB
            if (gp.buttons[4].pressed) zoomMult = 0.95; // LB

            if (Math.abs(dx) > 0 || Math.abs(dy) > 0 || zoomMult !== 1) {
                onInteractionStart?.();
                
                // Calculate Pan Speed relative to Zoom
                const sensitivity = currentConfig.panSensitivity * 0.05;
                const scale = 3.0 / currentConfig.zoom;
                
                const moveX = dx * sensitivity * scale;
                const moveY = dy * sensitivity * scale;

                const newCx = currentConfig.centerX + moveX;
                const newCy = currentConfig.centerY + moveY;
                const newZoom = currentConfig.zoom * zoomMult;

                onUpdateView({ centerX: newCx, centerY: newCy, zoom: newZoom });
                
                // Keep interaction active
                if ((window as any).gpInteractionTimer) clearTimeout((window as any).gpInteractionTimer);
                (window as any).gpInteractionTimer = setTimeout(() => onInteractionEnd?.(), 100);
            }
        }
        animationFrameId = requestAnimationFrame(pollGamepad);
    };
    
    animationFrameId = requestAnimationFrame(pollGamepad);
    return () => cancelAnimationFrame(animationFrameId);
  }, [onUpdateView, onInteractionStart, onInteractionEnd]);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        let dx = 0;
        let dy = 0;
        let zoomMult = 1;
        const step = 0.1 * config.panSensitivity;

        switch(e.key) {
            case 'ArrowUp': dy = step; break;
            case 'ArrowDown': dy = -step; break;
            case 'ArrowLeft': dx = -step; break;
            case 'ArrowRight': dx = step; break;
            case '+': case '=': zoomMult = 1.2; break;
            case '-': case '_': zoomMult = 0.8; break;
            default: return;
        }

        e.preventDefault();
        onInteractionStart?.();
        
        const scale = 3.0 / config.zoom;
        const newCx = config.centerX + dx * scale;
        const newCy = config.centerY + dy * scale;
        const newZoom = config.zoom * zoomMult;

        onUpdateView({ centerX: newCx, centerY: newCy, zoom: newZoom });
        
        if ((window as any).keyInteractionTimer) clearTimeout((window as any).keyInteractionTimer);
        (window as any).keyInteractionTimer = setTimeout(() => onInteractionEnd?.(), 100);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config, onUpdateView, onInteractionStart, onInteractionEnd]);

  // Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    if (!isInteracting) onInteractionStart?.();
    
    const delta = Math.max(-100, Math.min(100, e.deltaY)); 
    const zoomFactor = Math.exp(-delta * 0.003); 
    const newZoom = config.zoom * zoomFactor;

    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    const w = rect.width;
    const h = rect.height;
    const aspect = w / h;
    
    const u = (mx / w - 0.5) * aspect * 2.0; 
    const v = -(my / h - 0.5) * 2.0;
    
    const currentScale = 1.5 / config.zoom; 
    const wx = config.centerX + u * currentScale;
    const wy = config.centerY + v * currentScale;

    const newScale = 1.5 / newZoom;
    const newCx = wx - u * newScale;
    const newCy = wy - v * newScale;

    onUpdateView({ zoom: newZoom, centerX: newCx, centerY: newCy });
    
    if ((window as any).scrollTimer) clearTimeout((window as any).scrollTimer);
    (window as any).scrollTimer = setTimeout(() => onInteractionEnd?.(), 150);
  };

  // Pointer Events (Mouse Drag)
  const handlePointerDown = (e: React.PointerEvent) => {
    canvasRef.current?.setPointerCapture(e.pointerId);
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    onInteractionStart?.();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    if (!canvasRef.current) return;
    
    if (e.pointerType === 'mouse' || (e.pointerType === 'touch' && e.isPrimary)) {
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        lastMousePos.current = { x: e.clientX, y: e.clientY };

        const h = canvasRef.current.clientHeight;
        const scale = 3.0 / config.zoom;
        const worldDx = -(dx / h) * scale;
        const worldDy = (dy / h) * scale; 
        
        onUpdateView({
            centerX: config.centerX + worldDx,
            centerY: config.centerY + worldDy 
        });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    touchState.current.initialDist = null;
    canvasRef.current?.releasePointerCapture(e.pointerId);
    onInteractionEnd?.();
  };

  // Touch handlers for Pinch Zoom
  const handleTouchStart = (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
          touchState.current = {
              initialDist: dist,
              initialZoom: config.zoom,
              initialCenter: { x: config.centerX, y: config.centerY }
          };
      }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (e.touches.length === 2 && canvasRef.current) {
          e.preventDefault();
          onInteractionStart?.();
          
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
          
          // Midpoint of the two fingers
          const midX = (t1.clientX + t2.clientX) / 2;
          const midY = (t1.clientY + t2.clientY) / 2;

          if (touchState.current.initialDist !== null) {
              const scale = dist / touchState.current.initialDist;
              const newZoom = touchState.current.initialZoom * scale;

              // Calculate world coordinates of the pinch center
              const rect = canvasRef.current.getBoundingClientRect();
              const mx = midX - rect.left;
              const my = midY - rect.top;
              
              const w = rect.width;
              const h = rect.height;
              const aspect = w / h;
              
              // Screen to UV
              const u = (mx / w - 0.5) * aspect * 2.0; 
              const v = -(my / h - 0.5) * 2.0;
              
              // UV to World (Pre-zoom)
              const initialScale = 1.5 / touchState.current.initialZoom; 
              const wx = touchState.current.initialCenter.x + u * initialScale;
              const wy = touchState.current.initialCenter.y + v * initialScale;

              // Calculate new Center so that (wx, wy) stays at (u, v) under newZoom
              const newScale = 1.5 / newZoom;
              const newCx = wx - u * newScale;
              const newCy = wy - v * newScale;

              onUpdateView({ zoom: newZoom, centerX: newCx, centerY: newCy });
          }
      }
  };
  
  const handleTouchEnd = () => {
      touchState.current.initialDist = null;
      onInteractionEnd?.();
  };
  
  return (
    <div className={`w-full h-full transition-all duration-300 ${isTransitioning ? 'opacity-50 blur-sm scale-[0.98]' : 'opacity-100 blur-0 scale-100'}`}>
        <canvas
        ref={canvasRef}
        className="block w-full h-full cursor-move touch-none"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        />
    </div>
  );
};

export default FractalCanvas;