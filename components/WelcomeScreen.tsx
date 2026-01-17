
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React from 'react';

interface WelcomeScreenProps {
  visible: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ visible }) => {
  return (
    <div className={`
        absolute top-24 left-0 w-full pointer-events-none flex justify-center z-10 select-none
        transition-all duration-500 ease-out transform font-sans
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'}
    `}>
      <div className="text-center flex flex-col items-center gap-6 bg-slate-900/60 backdrop-blur-xl p-10 rounded-[40px] border border-slate-700/50 shadow-2xl">
        <div className="flex flex-col items-center">
            <div className="bg-sky-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3">REFINED ART ENGINE</div>
            <h1 className="text-5xl font-black text-white uppercase tracking-tighter mb-2">
                Infinite Gallery
            </h1>
            <div className="h-1 w-20 bg-sky-500 rounded-full mb-4" />
            <div className="text-sm font-extrabold text-slate-400 uppercase tracking-[0.4em]">
                Deep Depth & Realistic Lighting
            </div>
        </div>
        
        <div className="space-y-3">
            <p className="text-lg font-bold text-slate-200">The fog has lifted.</p>
            <p className="text-slate-400 font-medium max-w-sm leading-relaxed">
                Experience crystal-clear voxel generation with ambient occlusion, filmic tone mapping, and soft dynamic shadows.
            </p>
        </div>

        <div className="flex gap-2">
           <div className="w-2 h-2 rounded-full bg-sky-500 animate-bounce [animation-delay:-0.3s]" />
           <div className="w-2 h-2 rounded-full bg-sky-500 animate-bounce [animation-delay:-0.15s]" />
           <div className="w-2 h-2 rounded-full bg-sky-500 animate-bounce" />
        </div>
      </div>
    </div>
  );
};
