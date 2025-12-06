import React, { useEffect } from 'react';

interface GameOverScreenProps {
  isVictory: boolean;
  narrative: string;
  onRestart: () => void;
}

const GameOverScreen: React.FC<GameOverScreenProps> = ({ isVictory, narrative, onRestart }) => {
  
  useEffect(() => {
    // Audio Synthesis for Game Over / Victory
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const t = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);

    if (isVictory) {
      // Victory Sound: Major Chord Arpeggio (Bright, Uplifting)
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        
        const noteGain = ctx.createGain();
        noteGain.gain.setValueAtTime(0, t);
        noteGain.gain.linearRampToValueAtTime(0.1, t + i * 0.15 + 0.1);
        noteGain.gain.exponentialRampToValueAtTime(0.001, t + 4);
        
        osc.connect(noteGain);
        noteGain.connect(masterGain);
        
        osc.start(t + i * 0.15);
        osc.stop(t + 4.5);
      });
    } else {
      // DRAMATIC GAME OVER SOUND: "The Abyssal Fall"
      
      // 1. The Impact (Heavy Slam)
      // Simulating a heavy hit using low freq square waves and noise-like burst
      const impactOsc = ctx.createOscillator();
      const impactGain = ctx.createGain();
      
      impactOsc.type = 'square';
      impactOsc.frequency.setValueAtTime(100, t);
      impactOsc.frequency.exponentialRampToValueAtTime(20, t + 0.5); // Rapid pitch drop
      
      impactGain.gain.setValueAtTime(0.8, t);
      impactGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      
      impactOsc.connect(impactGain);
      impactGain.connect(masterGain);
      impactOsc.start(t);
      impactOsc.stop(t + 0.8);

      // 2. The Dark Drone (Tritone Dissonance)
      // C2 (65.41Hz) and F#2 (92.50Hz) - The "Devil's Interval"
      const droneOsc1 = ctx.createOscillator();
      const droneOsc2 = ctx.createOscillator();
      const droneFilter = ctx.createBiquadFilter();
      const droneGain = ctx.createGain();

      droneOsc1.type = 'sawtooth';
      droneOsc1.frequency.setValueAtTime(65.41, t);
      droneOsc1.frequency.linearRampToValueAtTime(60, t + 6); // Detune down slowly

      droneOsc2.type = 'sawtooth';
      droneOsc2.frequency.setValueAtTime(92.50, t); 
      droneOsc2.frequency.linearRampToValueAtTime(88, t + 6); // Detune

      droneFilter.type = 'lowpass';
      droneFilter.frequency.setValueAtTime(800, t);
      droneFilter.frequency.exponentialRampToValueAtTime(50, t + 5); // Filter closes to make it darker

      droneGain.gain.setValueAtTime(0, t);
      droneGain.gain.linearRampToValueAtTime(0.4, t + 0.1); // Attack
      droneGain.gain.exponentialRampToValueAtTime(0.001, t + 7); // Long tail

      droneOsc1.connect(droneFilter);
      droneOsc2.connect(droneFilter);
      droneFilter.connect(droneGain);
      droneGain.connect(masterGain);

      droneOsc1.start(t);
      droneOsc2.start(t);
      droneOsc1.stop(t + 7);
      droneOsc2.stop(t + 7);

      // 3. The Ghostly Wail (Unsettling Highs)
      // High pitched sine with vibrato sliding down
      const ghostOsc = ctx.createOscillator();
      const ghostGain = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();

      ghostOsc.type = 'sine';
      ghostOsc.frequency.setValueAtTime(554.37, t); // C#5 (Dissonant against C root)
      ghostOsc.frequency.linearRampToValueAtTime(300, t + 6); // Dying fall

      lfo.frequency.value = 6; // Fast vibrato
      lfoGain.gain.value = 15; // Depth
      
      lfo.connect(lfoGain);
      lfoGain.connect(ghostOsc.frequency);

      ghostGain.gain.setValueAtTime(0, t);
      ghostGain.gain.linearRampToValueAtTime(0.1, t + 2); // Slow fade in
      ghostGain.gain.exponentialRampToValueAtTime(0.001, t + 6);

      lfo.start(t);
      ghostOsc.connect(ghostGain);
      ghostGain.connect(masterGain);
      ghostOsc.start(t);
      
      lfo.stop(t + 6);
      ghostOsc.stop(t + 6);
    }

    return () => {
        if(ctx.state !== 'closed') ctx.close().catch(e => console.log(e));
    }
  }, [isVictory]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white p-4 relative overflow-hidden">
        {/* Background Atmosphere */}
        <div className={`absolute inset-0 z-0 opacity-20 ${isVictory ? 'bg-yellow-900' : 'bg-red-950'}`}></div>
        
        <div className={`relative z-10 max-w-3xl text-center p-10 border-4 border-double ${isVictory ? 'border-yellow-500 bg-black/80 shadow-[0_0_50px_rgba(234,179,8,0.3)]' : 'border-red-800 bg-black/90 shadow-[0_0_50px_rgba(153,27,27,0.3)]'} rounded-lg animate-fade-in`}>
          <h2 className={`text-6xl rpg-font mb-8 tracking-widest ${isVictory ? 'text-yellow-400 drop-shadow-md' : 'text-red-600 drop-shadow-[0_2px_4px_rgba(0,0,0,1)]'}`}>
            {isVictory ? 'TAKDIR TERPENUHI' : 'AKHIR HAYAT'}
          </h2>
          
          <div className="prose prose-invert prose-lg mb-10 text-gray-300 max-h-[60vh] overflow-y-auto scrollbar-hide px-4 leading-relaxed font-serif">
            <p className="whitespace-pre-wrap">{narrative}</p>
          </div>
          
          <div className="flex gap-4 justify-center">
             <button 
              onClick={onRestart}
              className={`px-8 py-3 border-2 font-bold tracking-wider uppercase transition-all transform hover:scale-105 rounded 
                ${isVictory 
                  ? 'border-yellow-600 text-yellow-500 hover:bg-yellow-900/30' 
                  : 'border-red-800 text-red-500 hover:bg-red-900/30'
                }`}
            >
              Kembali ke Menu Utama
            </button>
          </div>
        </div>
      </div>
  );
};

export default GameOverScreen;