
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VoxelEngine } from './services/VoxelEngine';
import { UIOverlay } from './components/UIOverlay';
import { JsonModal } from './components/JsonModal';
import { WelcomeScreen } from './components/WelcomeScreen';
import { Generators } from './utils/voxelGenerators';
import { AppState, VoxelData, SavedModel } from './types';
import { GoogleGenAI, Type } from "@google/genai";

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  
  const [appState, setAppState] = useState<AppState>(AppState.STABLE);
  const [voxelCount, setVoxelCount] = useState<number>(0);
  
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonModalMode, setJsonModalMode] = useState<'view' | 'import'>('view');
  
  const [showWelcome, setShowWelcome] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Core autonomous state
  const [isAutopilot, setIsAutopilot] = useState(true);
  const [cycleSpeed, setCycleSpeed] = useState(15); 
  
  const [jsonData, setJsonData] = useState('');
  const [isAutoRotate, setIsAutoRotate] = useState(true);

  const [currentBaseModel, setCurrentBaseModel] = useState<string>('Voxel Eagle');
  const [customBuilds, setCustomBuilds] = useState<SavedModel[]>([]);
  const [customRebuilds, setCustomRebuilds] = useState<SavedModel[]>([]);

  // Pre-fetched next model to eliminate "thinking" wait time during transition
  const nextModelRef = useRef<{ name: string; data: VoxelData[] } | null>(null);
  const fetchInProgress = useRef(false);
  const consecutiveFailures = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new VoxelEngine(
      containerRef.current,
      (newState) => setAppState(newState),
      (count) => setVoxelCount(count)
    );

    engineRef.current = engine;
    engine.loadInitialModel(Generators.Eagle());

    const handleResize = () => engine.handleResize();
    window.addEventListener('resize', handleResize);

    const timer = setTimeout(() => setShowWelcome(false), 5000);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
      engine.cleanup();
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setGenerating(isGenerating);
  }, [isGenerating]);

  /**
   * Proactive Fetch: Start fetching the next idea in the background
   */
  const fetchNextModel = useCallback(async () => {
    if (!process.env.API_KEY || fetchInProgress.current) return;
    
    fetchInProgress.current = true;
    
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const model = 'gemini-3-flash-preview';
        
        const response = await ai.models.generateContent({
            model,
            contents: "Design a spectacular and unique voxel art structure for the gallery.",
            config: {
                systemInstruction: `You are a master voxel artist specializing in high-fidelity 3D sculptures.
                  Task: Generate a creative 3D model in JSON format.
                  
                  Themes (Choose one at random for each generation): 
                  - Ancient Mythology: Egyptian sphinxes, Greek temples, or legendary artifacts like Mjölnir.
                  - Retro Futurism: 80s synthwave cars, neon cassette players, or chunky 90s computers.
                  - Miniature Dioramas: A tiny floating island with a single tree, a micro-lighthouse on a rock, or a desert oasis.
                  - High Fantasy: Dragon heads, wizard staffs, or enchanted crystal formations.
                  - Sci-Fi: AI neural cores, orbital satellites, or mecha limbs.
                  - Pop Culture Icons: Classic gaming consoles, pixelated power-ups, or famous movie masks.
                  
                  Aesthetic Guidelines:
                  - Use vibrant, high-contrast colors. 
                  - Incorporate neon/emissive colors (Bright Cyan #00FFFF, Neon Pink #FF00FF, Lime Green #00FF00) for "energy" parts to trigger the bloom effect.
                  - Ensure the structure has a clear "subject" and isn't just a blob.
                  
                  Constraints: 
                  - Total Voxels: 120 to 250. Aim for detailed yet recognizable forms.
                  - Coordinates: Use integers, centered at (0,0,0).
                  - Output ONLY a JSON object with "name" (the creative title) and "voxels" array.`,
                thinkingConfig: { thinkingBudget: 0 },
                maxOutputTokens: 8192, 
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        voxels: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    x: { type: Type.INTEGER },
                                    y: { type: Type.INTEGER },
                                    z: { type: Type.INTEGER },
                                    color: { type: Type.STRING }
                                },
                                required: ["x", "y", "z", "color"]
                            }
                        }
                    },
                    required: ["name", "voxels"]
                }
            }
        });

        if (response.text) {
            const result = JSON.parse(response.text);
            const voxelData: VoxelData[] = result.voxels.map((v: any) => {
                let colorStr = v.color || '#CCCCCC';
                if (colorStr.startsWith('#')) colorStr = colorStr.substring(1);
                const colorInt = parseInt(colorStr, 16);
                return {
                    x: Number(v.x) || 0, 
                    y: Number(v.y) || 0, 
                    z: Number(v.z) || 0,
                    color: isNaN(colorInt) ? 0xCCCCCC : colorInt
                };
            });
            nextModelRef.current = { name: result.name || "AI Creation", data: voxelData };
            consecutiveFailures.current = 0;
        }
    } catch (err) {
        console.error("Autonomous Background Fetch failed", err);
        consecutiveFailures.current++;
        
        if (consecutiveFailures.current > 2) {
            const localGens = [Generators.Cat, Generators.Rabbit, Generators.SpaceStation, Generators.Twins];
            const gen = localGens[Math.floor(Math.random() * localGens.length)];
            nextModelRef.current = { name: "Local Blueprint", data: gen() };
            consecutiveFailures.current = 0;
        }
    } finally {
        fetchInProgress.current = false;
        setIsGenerating(false); 
    }
  }, []);

  // --- Fully Autonomous Orchestration ---
  useEffect(() => {
    if (!isAutopilot) return;

    let timeout: ReturnType<typeof setTimeout>;

    const runCycle = async () => {
      if (appState === AppState.STABLE) {
        if (!nextModelRef.current && !fetchInProgress.current) {
            fetchNextModel();
        }

        timeout = setTimeout(() => {
          if (engineRef.current) {
            engineRef.current.dismantle();
          }
        }, cycleSpeed * 1000);
      } 
      else if (appState === AppState.DISMANTLING) {
        timeout = setTimeout(() => {
            if (nextModelRef.current) {
                const { name, data } = nextModelRef.current;
                nextModelRef.current = null;
                setCurrentBaseModel(name);
                engineRef.current?.rebuild(data);
                setIsGenerating(false);
            } else {
                if (!fetchInProgress.current) {
                    fetchNextModel();
                }
                setIsGenerating(true);
                runCycle(); 
            }
        }, 200); 
      }
    };

    runCycle();
    return () => clearTimeout(timeout);
  }, [appState, isAutopilot, cycleSpeed, fetchNextModel]);

  const handleShowJson = () => {
    if (engineRef.current) {
      setJsonData(engineRef.current.getJsonData());
      setJsonModalMode('view');
      setIsJsonModalOpen(true);
    }
  };

  const handleJsonImport = (jsonStr: string) => {
      try {
          const rawData = JSON.parse(jsonStr);
          if (!Array.isArray(rawData)) throw new Error("JSON must be an array");
          const voxelData: VoxelData[] = rawData.map((v: any) => {
              let colorVal = v.c || v.color;
              let colorInt = 0xCCCCCC;
              if (typeof colorVal === 'string') {
                  if (colorVal.startsWith('#')) colorVal = colorVal.substring(1);
                  colorInt = parseInt(colorVal, 16);
              } else if (typeof colorVal === 'number') colorInt = colorVal;
              return {
                  x: Number(v.x) || 0, y: Number(v.y) || 0, z: Number(v.z) || 0,
                  color: isNaN(colorInt) ? 0xCCCCCC : colorInt
              };
          });
          if (engineRef.current) {
              engineRef.current.loadInitialModel(voxelData);
              setCurrentBaseModel('Imported Build');
          }
      } catch (e) {
          console.error("Import failed", e);
      }
  };

  const handleToggleRotation = () => {
      const newState = !isAutoRotate;
      setIsAutoRotate(newState);
      if (engineRef.current) engineRef.current.setAutoRotate(newState);
  }

  return (
    <div className="relative w-full h-screen bg-[#0F172A] overflow-hidden">
      <div ref={containerRef} className="absolute inset-0 z-0" />
      
      <UIOverlay 
        voxelCount={voxelCount}
        appState={appState}
        currentBaseModel={currentBaseModel}
        customBuilds={customBuilds}
        customRebuilds={customRebuilds} 
        isAutoRotate={isAutoRotate}
        isInfoVisible={showWelcome}
        isGenerating={isGenerating}
        isAutopilot={isAutopilot}
        cycleSpeed={cycleSpeed}
        onCycleSpeedChange={setCycleSpeed}
        onToggleAutopilot={() => setIsAutopilot(!isAutopilot)}
        onDismantle={() => {}} 
        onRebuild={() => {}}   
        onNewScene={() => {}}   
        onSelectCustomBuild={() => {}}
        onSelectCustomRebuild={() => {}}
        onPromptCreate={() => {}}
        onPromptMorph={() => {}}
        onShowJson={handleShowJson}
        onImportJson={() => setIsJsonModalOpen(true)}
        onToggleRotation={handleToggleRotation}
        onToggleInfo={() => setShowWelcome(!showWelcome)}
      />

      <WelcomeScreen visible={showWelcome} />

      <JsonModal 
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        data={jsonData}
        isImport={jsonModalMode === 'import'}
        onImport={handleJsonImport}
      />
    </div>
  );
};

export default App;
