import React, { useState, useCallback } from 'react';
import FractalCanvas from './components/FractalCanvas';
import Controls from './components/Controls';
import { FractalConfig } from './types';
import { INITIAL_CONFIG } from './constants';

const App: React.FC = () => {
  const [config, setConfig] = useState<FractalConfig>(INITIAL_CONFIG);
  const [isInteracting, setIsInteracting] = useState(false);

  const handleUpdateConfig = useCallback((newConfig: Partial<FractalConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  const handleInteractionStart = useCallback(() => setIsInteracting(true), []);
  const handleInteractionEnd = useCallback(() => setIsInteracting(false), []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <FractalCanvas 
        config={config} 
        onUpdateView={handleUpdateConfig} 
        isInteracting={isInteracting}
        onInteractionStart={handleInteractionStart}
        onInteractionEnd={handleInteractionEnd}
      />
      <Controls 
        config={config} 
        onUpdate={handleUpdateConfig} 
        onInteractionStart={handleInteractionStart}
        onInteractionEnd={handleInteractionEnd}
      />
    </div>
  );
};

export default App;