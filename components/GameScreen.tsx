import React, { useState, useEffect, useRef } from 'react';
import { Player, PlayerStats, Choice, CombatEncounter, MonsterEntry } from '../types';

interface GameScreenProps {
  player: Player;
  narrative: string;
  choices: Choice[];
  combatEncounter?: CombatEncounter | null;
  visualKeyword: string;
  visitedLocations: string[];
  bestiary: MonsterEntry[];
  onMakeChoice: (choice: string) => void;
  isLoading: boolean;
  onSave: () => void;
  onQuit: () => void;
  onUpdatePlayer: (player: Player) => void;
}

// Shop Inventory Data
const SHOP_ITEMS = [
  { name: "Ramuan Penyembuh", price: 50, desc: "Memulihkan sebagian HP." },
  { name: "Ransum Makanan", price: 20, desc: "Bekal untuk perjalanan jauh." },
  { name: "Mana Elixir", price: 60, desc: "Memulihkan energi magis (MP)." },
  { name: "Gulungan Api", price: 120, desc: "Sihir serangan sekali pakai." },
  { name: "Jimat Keberuntungan", price: 200, desc: "Benda mistis berkilauan." },
  { name: "Obor Abadi", price: 40, desc: "Tidak pernah padam oleh angin." }
];

// Utility to generate dynamic description for inspection
const getItemDescription = (item: string) => {
  const lower = item.toLowerCase();
  if (lower.includes('potion') || lower.includes('ramuan') || lower.includes('obat') || lower.includes('elixir')) return "Memulihkan kesehatan atau mana peminumnya. Terasa sedikit pahit.";
  if (lower.includes('sword') || lower.includes('pedang') || lower.includes('blade') || lower.includes('pisau')) return "Senjata tajam untuk pertarungan jarak dekat. Bilahnya berkilau suram.";
  if (lower.includes('bow') || lower.includes('panah')) return "Senjata jarak jauh untuk menyerang dari kejauhan.";
  if (lower.includes('armor') || lower.includes('zirah') || lower.includes('baju') || lower.includes('jubah') || lower.includes('shield') || lower.includes('tameng')) return "Perlengkapan defensif untuk mengurangi dampak serangan musuh.";
  if (lower.includes('map') || lower.includes('peta')) return "Lembaran kuno yang menunjukkan kontur wilayah sekitar.";
  if (lower.includes('key') || lower.includes('kunci')) return "Alat kecil yang mungkin membuka pintu atau peti harta karun.";
  if (lower.includes('gold') || lower.includes('coin') || lower.includes('emas')) return "Mata uang standar yang berlaku di kerajaan ini.";
  if (lower.includes('scroll') || lower.includes('gulungan') || lower.includes('api')) return "Berisi mantra atau pengetahuan kuno yang terlupakan.";
  if (lower.includes('ring') || lower.includes('cincin') || lower.includes('amulet') || lower.includes('kalung') || lower.includes('jimat')) return "Perhiasan yang mungkin memiliki kekuatan magis tersembunyi.";
  if (lower.includes('food') || lower.includes('makanan') || lower.includes('ransum') || lower.includes('roti')) return "Bekal perjalanan untuk mengganjal lapar dan memulihkan sedikit tenaga.";
  if (lower.includes('obor')) return "Alat penerangan yang sangat berguna di gua gelap.";
  return "Sebuah benda misterius yang Anda temukan dalam perjalanan. Kegunaannya belum sepenuhnya diketahui.";
};

// --- Audio Configuration Types ---
interface AmbienceConfig {
  filterType: BiquadFilterType;
  baseFreq: number; // Base cutoff frequency
  lfoRate: number; // How fast the wind/atmosphere changes
  lfoDepth: number; // How much the frequency shifts
  noiseGain: number; // Volume of the noise layer
  droneFreq?: number; // Optional drone oscillator for magic/tech
  droneGain?: number;
}

const getAmbienceForBiome = (keyword: string): AmbienceConfig => {
  const k = keyword.toLowerCase();
  
  if (k.includes('forest') || k.includes('jungle') || k.includes('wood') || k.includes('garden')) {
    return { filterType: 'bandpass', baseFreq: 600, lfoRate: 0.1, lfoDepth: 300, noiseGain: 0.04 };
  }
  if (k.includes('mountain') || k.includes('sky') || k.includes('tower') || k.includes('cloud')) {
    return { filterType: 'highpass', baseFreq: 400, lfoRate: 0.2, lfoDepth: 200, noiseGain: 0.03 };
  }
  if (k.includes('sea') || k.includes('water') || k.includes('river') || k.includes('beach')) {
    return { filterType: 'lowpass', baseFreq: 300, lfoRate: 0.3, lfoDepth: 150, noiseGain: 0.06 };
  }
  if (k.includes('city') || k.includes('town') || k.includes('village') || k.includes('tavern')) {
    return { filterType: 'lowpass', baseFreq: 800, lfoRate: 0.05, lfoDepth: 50, noiseGain: 0.04 };
  }
  if (k.includes('magic') || k.includes('cyber') || k.includes('neon') || k.includes('tech') || k.includes('lab')) {
    return { filterType: 'lowpass', baseFreq: 200, lfoRate: 0.1, lfoDepth: 50, noiseGain: 0.03, droneFreq: 110, droneGain: 0.03 };
  }
  return { filterType: 'lowpass', baseFreq: 150, lfoRate: 0.05, lfoDepth: 50, noiseGain: 0.06 };
};

// --- Floating Text Interface ---
interface FloatingText {
  id: number;
  text: string;
  type: 'damage' | 'heal' | 'miss' | 'crit' | 'dodge' | 'info';
  x: number;
  y: number;
}

const GameScreen: React.FC<GameScreenProps> = ({ 
  player, 
  narrative, 
  choices, 
  combatEncounter,
  visualKeyword, 
  visitedLocations,
  bestiary,
  onMakeChoice, 
  isLoading,
  onSave,
  onQuit,
  onUpdatePlayer
}) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const combatLogRef = React.useRef<HTMLDivElement>(null);
  
  // Audio Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const filterNodeRef = useRef<BiquadFilterNode | null>(null);
  const ambienceGainRef = useRef<GainNode | null>(null);
  const lfoNodeRef = useRef<OscillatorNode | null>(null);
  const lfoGainRef = useRef<GainNode | null>(null);
  const droneNodeRef = useRef<OscillatorNode | null>(null);
  const droneGainRef = useRef<GainNode | null>(null);
  
  // Level Up Tracking
  const prevLevelRef = useRef<number>(player.level);

  const [saveStatus, setSaveStatus] = useState<string>("");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showContent, setShowContent] = useState<boolean>(true);
  
  // Modals
  const [showSellModal, setShowSellModal] = useState<boolean>(false);
  const [showShopModal, setShowShopModal] = useState<boolean>(false); // New Shop Modal State
  const [selectedItemToSell, setSelectedItemToSell] = useState<number | null>(null);
  const [inspectItem, setInspectItem] = useState<string | null>(null);

  // --- NEW COMBAT STATE ---
  const [isRolling, setIsRolling] = useState(false);
  const [diceValue, setDiceValue] = useState<number | null>(null);
  const [showCombatModal, setShowCombatModal] = useState(false);
  const [isAutoCombat, setIsAutoCombat] = useState<boolean>(false);
  const turnTriggeredRef = useRef<boolean>(false);
  
  // Combat Logic State
  const [combatPhase, setCombatPhase] = useState<'player_turn' | 'enemy_turn' | 'victory' | 'defeat'>('player_turn');
  const [enemyHp, setEnemyHp] = useState<number>(0);
  const [combatLogs, setCombatLogs] = useState<string[]>([]);
  const [shakeScreen, setShakeScreen] = useState<boolean>(false);
  const [enemyFlash, setEnemyFlash] = useState<boolean>(false); // NEW: For Critical Hit Visual
  
  // Floating Text State
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const nextFloatingId = useRef(0);

  // --- Animation Logic ---
  useEffect(() => {
    if (isLoading) {
      setShowContent(false);
    } else {
      const timer = setTimeout(() => {
        setShowContent(true);
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 0;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading, narrative]);

  // --- Combat Trigger Logic ---
  useEffect(() => {
      if (combatEncounter) {
          setShowCombatModal(true);
          setCombatPhase('player_turn');
          setEnemyHp(combatEncounter.hp);
          setCombatLogs([`<span class="text-gray-400 italic">Muncul ${combatEncounter.enemyName}! HP: ${combatEncounter.hp}/${combatEncounter.maxHp}</span>`]);
          setDiceValue(null);
          setIsRolling(false);
          setFloatingTexts([]); // Clear old text
          setIsAutoCombat(false); // Reset auto combat
          setEnemyFlash(false);
          // Close other modals if open
          setShowSellModal(false);
          setShowShopModal(false);
      } else {
          setShowCombatModal(false);
          setIsAutoCombat(false);
      }
  }, [combatEncounter]);

  // Reset turn trigger when phase changes
  useEffect(() => {
    turnTriggeredRef.current = false;
  }, [combatPhase]);

  // Auto-scroll combat logs
  useEffect(() => {
      if (combatLogRef.current) {
          combatLogRef.current.scrollIntoView({ behavior: 'smooth' });
      }
  }, [combatLogs]);

  // --- Floating Text Logic ---
  const triggerFloatingText = (text: string, type: FloatingText['type']) => {
    const id = nextFloatingId.current++;
    // Random position offset near center/top of modal area
    const x = Math.random() * 40 - 20; // -20 to 20 px offset
    const y = Math.random() * 20 - 10;
    
    setFloatingTexts(prev => [...prev, { id, text, type, x, y }]);
    
    // Remove after animation
    setTimeout(() => {
        setFloatingTexts(prev => prev.filter(ft => ft.id !== id));
    }, 1000);
  };

  const getFloatingTextStyle = (type: FloatingText['type']) => {
    switch (type) {
        case 'damage': return 'text-red-500 font-bold text-4xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]';
        case 'crit': return 'text-yellow-400 font-extrabold text-5xl drop-shadow-[0_2px_4px_rgba(255,0,0,0.8)]';
        case 'miss': return 'text-gray-500 font-bold text-3xl italic opacity-80';
        case 'dodge': return 'text-cyan-400 font-bold text-3xl tracking-widest';
        case 'heal': return 'text-green-400 font-bold text-3xl';
        default: return 'text-white font-bold text-2xl';
    }
  };

  // --- Audio System (Web Audio API) ---
  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(e => console.log("Audio resume failed", e));
    }
    return audioCtxRef.current;
  };

  const generatePinkNoise = (ctx: AudioContext) => {
    const bufferSize = ctx.sampleRate * 4; 
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0, b1, b2, b3, b4, b5, b6;
    b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        data[i] *= 0.11; 
        b6 = white * 0.115926;
    }
    return buffer;
  };

  const startAmbience = () => {
    const ctx = initAudio();
    if (noiseNodeRef.current) return; 

    const buffer = generatePinkNoise(ctx);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.frequency.value = 200; 

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 100;
    
    const drone = ctx.createOscillator();
    drone.type = 'triangle';
    drone.frequency.value = 100;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0; 

    const masterGain = ctx.createGain();
    masterGain.gain.value = isMuted ? 0 : 0.0; 

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    noise.connect(filter);
    filter.connect(masterGain);
    drone.connect(droneGain);
    droneGain.connect(masterGain);
    masterGain.connect(ctx.destination);

    noise.start();
    lfo.start();
    drone.start();

    noiseNodeRef.current = noise;
    filterNodeRef.current = filter;
    ambienceGainRef.current = masterGain;
    lfoNodeRef.current = lfo;
    lfoGainRef.current = lfoGain;
    droneNodeRef.current = drone;
    droneGainRef.current = droneGain;

    updateAmbience(visualKeyword);
  };

  const updateAmbience = (keyword: string) => {
    if (!audioCtxRef.current || !filterNodeRef.current) return;
    
    const ctx = audioCtxRef.current;
    const config = getAmbienceForBiome(keyword);
    const t = ctx.currentTime;
    const transitionTime = 3; 

    if (filterNodeRef.current) {
        filterNodeRef.current.type = config.filterType;
        filterNodeRef.current.frequency.cancelScheduledValues(t);
        filterNodeRef.current.frequency.exponentialRampToValueAtTime(config.baseFreq, t + transitionTime);
    }

    if (lfoNodeRef.current) {
        lfoNodeRef.current.frequency.cancelScheduledValues(t);
        lfoNodeRef.current.frequency.linearRampToValueAtTime(config.lfoRate, t + transitionTime);
    }

    if (lfoGainRef.current) {
        lfoGainRef.current.gain.cancelScheduledValues(t);
        lfoGainRef.current.gain.linearRampToValueAtTime(config.lfoDepth, t + transitionTime);
    }

    if (droneNodeRef.current && droneGainRef.current) {
        if (config.droneFreq) {
            droneNodeRef.current.frequency.linearRampToValueAtTime(config.droneFreq, t + transitionTime);
            droneGainRef.current.gain.linearRampToValueAtTime(config.droneGain || 0, t + transitionTime);
        } else {
            droneGainRef.current.gain.linearRampToValueAtTime(0, t + transitionTime);
        }
    }

    if (ambienceGainRef.current && !isMuted) {
         ambienceGainRef.current.gain.cancelScheduledValues(t);
         ambienceGainRef.current.gain.linearRampToValueAtTime(config.noiseGain * 0.3, t + 0.5); 
         ambienceGainRef.current.gain.linearRampToValueAtTime(config.noiseGain, t + transitionTime + 1);
    }
  };

  const toggleMute = () => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    initAudio();
    if (!ambienceGainRef.current && !newMuteState) startAmbience();
    if (ambienceGainRef.current && audioCtxRef.current) {
        const t = audioCtxRef.current.currentTime;
        ambienceGainRef.current.gain.cancelScheduledValues(t);
        ambienceGainRef.current.gain.setTargetAtTime(newMuteState ? 0 : 0.05, t, 0.5);
    }
  };

  const playSfx = (type: 'click' | 'sell' | 'critical' | 'levelup' | 'dice_roll' | 'combat_win' | 'combat_lose' | 'combat_hit' | 'combat_crit' | 'combat_dodge') => {
    if (isMuted) return;
    const ctx = initAudio();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'combat_hit') { // Punch sound
        const noise = ctx.createBufferSource();
        noise.buffer = generatePinkNoise(ctx);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 500;
        noise.connect(f);
        f.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        noise.start(t);
        noise.stop(t + 0.2);
        return;
    }

    if (type === 'combat_crit') { // Heavy Slash + Impact
        // Layer 1: Sharp Metal
        const metalOsc = ctx.createOscillator();
        metalOsc.type = 'sawtooth';
        metalOsc.frequency.setValueAtTime(600, t);
        metalOsc.frequency.exponentialRampToValueAtTime(100, t + 0.3);
        const metalGain = ctx.createGain();
        metalGain.gain.setValueAtTime(0.4, t);
        metalGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        metalOsc.connect(metalGain);
        metalGain.connect(ctx.destination);
        metalOsc.start(t);
        metalOsc.stop(t + 0.3);

        // Layer 2: Heavy Impact
        const subOsc = ctx.createOscillator();
        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(150, t);
        subOsc.frequency.exponentialRampToValueAtTime(30, t + 0.5);
        const subGain = ctx.createGain();
        subGain.gain.setValueAtTime(0.8, t);
        subGain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        subOsc.connect(subGain);
        subGain.connect(ctx.destination);
        subOsc.start(t);
        subOsc.stop(t + 0.5);
        return;
    }

    if (type === 'combat_dodge') { // Woosh
        const noise = ctx.createBufferSource();
        noise.buffer = generatePinkNoise(ctx);
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.setValueAtTime(400, t);
        f.frequency.linearRampToValueAtTime(1000, t + 0.3);
        noise.connect(f);
        f.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        noise.start(t);
        noise.stop(t + 0.3);
        return;
    }

    // ... Existing SFX code ...
    if (type === 'levelup') {
        const notes = [440, 554.37, 659.25, 880, 1108.73, 1318.51]; 
        notes.forEach((freq, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sine';
            o.frequency.value = freq;
            o.connect(g);
            g.connect(ctx.destination);
            o.start(t + i*0.08);
            o.stop(t + i*0.08 + 0.6);
            g.gain.setValueAtTime(0, t+i*0.08);
            g.gain.linearRampToValueAtTime(0.1, t + i*0.08 + 0.05);
            g.gain.exponentialRampToValueAtTime(0.001, t + i*0.08 + 0.6);
        });
        return;
    }

    if (type === 'click') {
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(300, t + 0.1);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.start(t); osc.stop(t+0.1);
    } else if (type === 'sell') {
        osc.frequency.setValueAtTime(1200, t);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        osc.start(t); osc.stop(t+0.15);
    } else if (type === 'critical') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.5);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);
        osc.start(t); osc.stop(t+0.8);
    } else if (type === 'dice_roll') {
        const noise = ctx.createBufferSource();
        noise.buffer = generatePinkNoise(ctx);
        noise.connect(gain);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        noise.start(t);
    } else if (type === 'combat_win') {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, i) => {
            const o = ctx.createOscillator();
            o.type='square'; o.frequency.value=freq; 
            const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
            o.start(t+i*0.1); o.stop(t+i*0.1+0.5);
            g.gain.setValueAtTime(0, t+i*0.1);
            g.gain.linearRampToValueAtTime(0.1, t+i*0.1+0.05);
            g.gain.exponentialRampToValueAtTime(0.01, t+i*0.1+0.4);
        });
    } else if (type === 'combat_lose') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.linearRampToValueAtTime(100, t + 0.5);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.5);
        osc.start(t); osc.stop(t+0.5);
    }
  };

  useEffect(() => {
     return () => {
         if (noiseNodeRef.current) noiseNodeRef.current.stop();
         if (lfoNodeRef.current) lfoNodeRef.current.stop();
         if (droneNodeRef.current) droneNodeRef.current.stop();
         if (audioCtxRef.current) audioCtxRef.current.close();
     };
  }, []);

  useEffect(() => {
      if (!isMuted) {
          if (!noiseNodeRef.current) {
          } else {
              updateAmbience(visualKeyword);
          }
      }
  }, [visualKeyword, isMuted, narrative]); 

  useEffect(() => {
      if (player.level > prevLevelRef.current) {
          playSfx('levelup');
      }
      prevLevelRef.current = player.level;
  }, [player.level]);

  const handleChoiceClick = (choice: Choice) => {
      playSfx(choice.isCritical ? 'critical' : 'click');
      if (!isMuted && !noiseNodeRef.current) startAmbience();
      onMakeChoice(choice.text);
  }

  const handleSave = () => {
    onSave();
    setSaveStatus("Tersimpan!");
    setTimeout(() => setSaveStatus(""), 2000);
  };
  
  const handleReplayNarrative = () => {
      setShowContent(false);
      setTimeout(() => {
          setShowContent(true);
          if (scrollRef.current) {
              scrollRef.current.scrollTop = 0;
          }
      }, 300);
  };

  // --- NEW COMBAT LOGIC ---
  const rollDie = (callback: (val: number) => void) => {
    if (isRolling) return;
    playSfx('dice_roll');
    setIsRolling(true);
    let rolls = 0;
    const interval = setInterval(() => {
        setDiceValue(Math.floor(Math.random() * 20) + 1);
        rolls++;
        if (rolls >= 10) {
            clearInterval(interval);
            const final = Math.floor(Math.random() * 20) + 1;
            setDiceValue(final);
            setIsRolling(false);
            callback(final);
        }
    }, 80);
  };

  const handlePlayerAttack = () => {
      if(!combatEncounter) return;
      rollDie((roll) => {
          const bonus = Math.floor(player.stats[combatEncounter.statUsed] / 2);
          const total = roll + bonus;
          
          if (total >= combatEncounter.difficulty) {
              const isNaturalCrit = roll === 20;

              // Scale damage with Level: Base + Dice + Stat + Level Scaling
              const baseDmg = 5;
              const weaponDice = Math.floor(Math.random() * 8) + 1; // 1d8
              const levelBonus = Math.floor(player.level * 2); 
              let dmg = baseDmg + weaponDice + bonus + levelBonus;

              if (isNaturalCrit) {
                  playSfx('combat_crit');
                  setEnemyFlash(true);
                  setTimeout(() => setEnemyFlash(false), 150); // Flash visual
                  dmg = Math.floor(dmg * 1.5); // Critical Damage Multiplier
                  addLog(`🔥 <b>CRITICAL HIT!</b> (Nat 20) Serangan mematikan sebesar <b>${dmg} DMG</b>!`, 'text-yellow-400 font-bold text-lg');
                  triggerFloatingText(`CRIT! -${dmg}`, 'crit');
              } else {
                  playSfx('combat_hit');
                  addLog(`⚔️ <b>HIT!</b> Anda menyerang ${combatEncounter.enemyName} sebesar <b>${dmg} DMG</b>!`, 'text-emerald-400');
                  triggerFloatingText(`HIT! -${dmg}`, 'damage');
              }

              const newHp = Math.max(0, enemyHp - dmg);
              setEnemyHp(newHp);
              
              setShakeScreen(true);
              setTimeout(() => setShakeScreen(false), 300);

              if (newHp <= 0) {
                  endCombat(true);
              } else {
                  // Pass turn to enemy
                  setTimeout(() => {
                      setCombatPhase('enemy_turn');
                      addLog(`⚠️ <b>${combatEncounter.enemyName}</b> bersiap menyerang dengan ${combatEncounter.attackDescription}!`, 'text-orange-400');
                  }, 1200);
              }
          } else {
              // Miss Logic
              triggerFloatingText('MISS', 'miss');
              addLog(`💨 <b>MISS!</b> Serangan anda gagal menembus pertahanan musuh.`, 'text-slate-500');
              setTimeout(() => {
                setCombatPhase('enemy_turn');
                addLog(`⚠️ <b>${combatEncounter.enemyName}</b> menyerang balik!`, 'text-orange-400');
            }, 1200);
          }
      });
  };

  const handlePlayerDodge = () => {
      if(!combatEncounter) return;
      rollDie((roll) => {
          const agilityBonus = Math.floor(player.stats.agility / 2);
          const total = roll + agilityBonus;
          
          // Difficulty to dodge usually matches enemy difficulty or slightly lower
          const dodgeDc = combatEncounter.difficulty; 

          if (total >= dodgeDc) {
              // Dodge Success
              playSfx('combat_dodge');
              triggerFloatingText('DODGE!', 'dodge');
              addLog(`✨ <b>DODGE!</b> Anda menghindari ${combatEncounter.attackDescription}!`, 'text-cyan-400');
              setTimeout(() => {
                  setCombatPhase('player_turn');
                  addLog("💪 Giliran anda menyerang!", 'text-yellow-400');
              }, 1200);
          } else {
              // Dodge Fail
              playSfx('combat_hit');
              const dmg = combatEncounter.damage;
              
              // Apply damage to player logic
              const newPlayer = {...player, stats: {...player.stats, hp: Math.max(0, player.stats.hp - dmg)}};
              onUpdatePlayer(newPlayer);
              
              triggerFloatingText(`-${dmg}`, 'damage');
              addLog(`💥 <b>CRITICAL!</b> ${combatEncounter.enemyName} melukai anda sebesar <b>${dmg} DMG</b>!`, 'text-red-500 bg-red-950/50 block p-1 rounded border border-red-900/50');
              setShakeScreen(true);
              setTimeout(() => setShakeScreen(false), 500);

              if (newPlayer.stats.hp <= 0) {
                  endCombat(false);
              } else {
                  setTimeout(() => {
                      setCombatPhase('player_turn');
                      addLog("💪 Bertahanlah! Giliran anda!", 'text-yellow-400');
                  }, 1200);
              }
          }
      });
  };

  const endCombat = (victory: boolean) => {
      setCombatPhase(victory ? 'victory' : 'defeat');
      playSfx(victory ? 'combat_win' : 'combat_lose');
      
      setTimeout(() => {
          setShowCombatModal(false);
          if (victory) {
              onMakeChoice(`[SYSTEM: COMBAT RESULT: VICTORY. Enemy Defeated. HP Remaining: ${player.stats.hp}]`);
          } else {
              onMakeChoice(`[SYSTEM: COMBAT RESULT: DEFEAT. Player Died.]`);
          }
      }, 2500);
  };

  const addLog = (msg: string, colorClass: string) => {
      // Removing slice limit to keep full combat history for the log
      setCombatLogs(prev => [ ...prev, `<span class="${colorClass}">${msg}</span>`]);
  };

  // --- Auto Combat Logic ---
  useEffect(() => {
    if (!isAutoCombat || !showCombatModal || !combatEncounter) return;
    if (isRolling || turnTriggeredRef.current) return;
    
    if (combatPhase === 'player_turn') {
        turnTriggeredRef.current = true;
        const timer = setTimeout(() => {
            handlePlayerAttack();
        }, 1000);
        return () => clearTimeout(timer);
    } else if (combatPhase === 'enemy_turn') {
        turnTriggeredRef.current = true;
        const timer = setTimeout(() => {
            handlePlayerDodge();
        }, 1000);
        return () => clearTimeout(timer);
    }
  }, [isAutoCombat, combatPhase, isRolling, showCombatModal, combatEncounter]);

  // --- Selling Logic ---
  const handleSellItem = () => {
      if (selectedItemToSell === null) return;
      
      const itemToSell = player.inventory[selectedItemToSell];
      const sellPrice = Math.floor(Math.random() * 41) + 10; 

      const updatedInventory = player.inventory.filter((_, idx) => idx !== selectedItemToSell);
      const updatedPlayer = {
          ...player,
          inventory: updatedInventory,
          gold: player.gold + sellPrice
      };

      onUpdatePlayer(updatedPlayer);
      setSelectedItemToSell(null);
      setShowSellModal(false);

      playSfx('sell');
      alert(`Terjual ${itemToSell} seharga ${sellPrice} Gold!`);
  };

  // --- Buying Logic ---
  const handleBuyItem = (item: {name: string, price: number}) => {
    if (player.gold >= item.price) {
        const updatedPlayer = {
            ...player,
            gold: player.gold - item.price,
            inventory: [...player.inventory, item.name]
        };
        onUpdatePlayer(updatedPlayer);
        playSfx('sell'); // Coin sound
    } else {
        playSfx('click'); // Or error sound
        alert("Gold tidak cukup!");
    }
  };

  // --- Mini Map Logic ---
  const MAP_SIZE = 16; 
  const getMapIndex = (keyword: string) => {
    let hash = 0;
    for (let i = 0; i < keyword.length; i++) {
      hash = keyword.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % MAP_SIZE;
  };

  const currentMapIndex = getMapIndex(visualKeyword);
  const visitedIndices = visitedLocations.map(loc => ({
    index: getMapIndex(loc),
    name: loc
  }));

  const getBiomeColor = (keyword: string) => {
    const k = keyword.toLowerCase();
    if (k.includes('forest') || k.includes('jungle')) return 'bg-green-700 border-green-500';
    if (k.includes('dungeon') || k.includes('cave')) return 'bg-purple-900 border-purple-600';
    if (k.includes('city') || k.includes('town')) return 'bg-blue-800 border-blue-500';
    if (k.includes('mountain') || k.includes('hill')) return 'bg-yellow-900 border-yellow-700';
    if (k.includes('sea') || k.includes('water')) return 'bg-cyan-800 border-cyan-500';
    return 'bg-gray-600 border-gray-400';
  };
  // --- End Mini Map Logic ---

  const stableImage = React.useMemo(() => {
      return `https://picsum.photos/seed/${visualKeyword + narrative.length}/1024/600`;
  }, [visualKeyword, narrative]);

  return (
    <div className={`flex flex-col md:flex-row h-screen bg-gray-900 text-gray-100 overflow-hidden ${shakeScreen ? 'animate-pulse' : ''}`}>
      
      {/* Left Panel: Stats & Character */}
      <div className="w-full md:w-1/4 bg-gray-800 border-r border-gray-700 p-6 flex flex-col shadow-2xl z-10 overflow-y-auto relative scrollbar-hide">
        <div className="mb-6 text-center">
          <h2 className="text-2xl rpg-font text-yellow-500">{player.name}</h2>
          <span className="text-sm text-gray-400 uppercase tracking-widest">{player.class} ({player.gender})</span>
          
          {/* Level & XP Display */}
          <div className="mt-2">
            <div className="flex justify-between text-xs text-yellow-200 mb-1">
                <span>Level {player.level}</span>
                <span>{player.currentXp} / {player.maxXp} XP</span>
            </div>
            <div className="w-full bg-gray-900 rounded-full h-2 border border-gray-700 overflow-hidden relative">
              <div 
                className="h-full bg-gradient-to-r from-yellow-700 via-yellow-500 to-yellow-300 transition-all duration-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]" 
                style={{ width: `${Math.min(100, (player.currentXp / player.maxXp) * 100)}%` }}
              ></div>
            </div>
          </div>
          
          {/* Gold Display */}
          <div className="mt-4 bg-gray-900/50 p-2 rounded border border-yellow-800 flex items-center justify-center text-yellow-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 mr-2">
                <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
              </svg>
              <span className="font-bold text-lg">{player.gold} Gold</span>
          </div>
        </div>

        {/* Audio Control */}
        <button 
          onClick={toggleMute}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors"
          title={isMuted ? "Unmute Sound" : "Mute Sound"}
        >
          {isMuted ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 21 12m0 0-3.75 2.25M21 12H3" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="m3 3 18 18" />
            </svg>
          ) : (
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
            </svg>
          )}
        </button>

        {/* Stats Section */}
        <div className="space-y-4 mb-6">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-red-400 font-bold">HP</span>
              <span>{player.stats.hp} / {player.stats.maxHp}</span>
            </div>
            <div className="w-full bg-gray-900 rounded-full h-2.5 border border-gray-700 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-red-900 via-red-600 to-red-500 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(220,38,38,0.5)]" 
                style={{ width: `${Math.max(0, (player.stats.hp / player.stats.maxHp) * 100)}%` }}
              ></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-blue-400 font-bold">MP</span>
              <span>{player.stats.mp} / {player.stats.maxMp}</span>
            </div>
            <div className="w-full bg-gray-900 rounded-full h-2.5 border border-gray-700 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-900 via-blue-600 to-blue-500 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(37,99,235,0.5)]" 
                style={{ width: `${Math.max(0, (player.stats.mp / player.stats.maxMp) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Enhanced Primary Stats */}
        <div className="grid grid-cols-1 gap-3 mb-6">
          {/* Strength */}
          <div className="bg-gray-800/80 p-3 rounded border border-gray-700 shadow-md flex flex-col hover:border-red-800 transition-colors">
            <div className="flex items-center mb-2">
                <div className="p-2 bg-red-900/30 rounded-full mr-3 border border-red-900 text-red-500">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                     <path fillRule="evenodd" d="M13.5 4.938a7 7 0 11-9.006 1.737c.2.267.59.267.783 0 .685-.912 2.43-1.2 3.32-.489.386.309.41 1.069.042 1.503l-1.808 2.142c-.418.495-.49 1.202-.192 1.762L9.49 16.5a1 1 0 001.95-.247l-.273-3.084c-.044-.492.357-.927.85-1.025l2.483-.497c.563-.113.818-.765.485-1.23l-1.488-2.083z" clipRule="evenodd" />
                   </svg>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-end">
                      <div className="text-xs text-gray-400 uppercase tracking-wider font-bold">Kekuatan</div>
                      <div className="font-bold text-lg text-red-400 drop-shadow">{player.stats.strength}</div>
                  </div>
                </div>
            </div>
            {/* Visual Bar for Strength */}
            <div className="w-full bg-gray-950 h-2 rounded-full overflow-hidden border border-gray-700 shadow-inner">
                 <div 
                   className="h-full bg-gradient-to-r from-red-900 via-red-600 to-red-500 transition-all duration-700 ease-out shadow-[0_0_8px_rgba(220,38,38,0.6)]" 
                   style={{ width: `${Math.min(100, (player.stats.strength / 50) * 100)}%` }}
                 ></div>
            </div>
            <div className="flex justify-between mt-1 px-1">
               <span className="text-[10px] text-gray-500 italic">Kapasitas Fisik</span>
               <span className="text-[10px] text-red-400 font-mono">Bonus Dadu: +{Math.floor(player.stats.strength / 2)}</span>
            </div>
          </div>

          {/* Intelligence */}
          <div className="bg-gray-800/80 p-3 rounded border border-gray-700 shadow-md flex flex-col hover:border-blue-800 transition-colors">
             <div className="flex items-center mb-2">
                 <div className="p-2 bg-blue-900/30 rounded-full mr-3 border border-blue-900 text-blue-500">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                     <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                   </svg>
                 </div>
                 <div className="flex-1">
                  <div className="flex justify-between items-end">
                    <div className="text-xs text-gray-400 uppercase tracking-wider font-bold">Kepintaran</div>
                    <div className="font-bold text-lg text-blue-400 drop-shadow">{player.stats.intelligence}</div>
                  </div>
                </div>
            </div>
            {/* Visual Bar for Intelligence */}
            <div className="w-full bg-gray-950 h-2 rounded-full overflow-hidden border border-gray-700 shadow-inner">
                 <div 
                    className="h-full bg-gradient-to-r from-blue-900 via-blue-600 to-blue-500 transition-all duration-700 ease-out shadow-[0_0_8px_rgba(59,130,246,0.6)]" 
                    style={{ width: `${Math.min(100, (player.stats.intelligence / 50) * 100)}%` }}
                 ></div>
            </div>
            <div className="flex justify-between mt-1 px-1">
               <span className="text-[10px] text-gray-500 italic">Kapasitas Mana</span>
               <span className="text-[10px] text-blue-400 font-mono">Bonus Dadu: +{Math.floor(player.stats.intelligence / 2)}</span>
            </div>
          </div>

          {/* Agility */}
          <div className="bg-gray-800/80 p-3 rounded border border-gray-700 shadow-md flex flex-col hover:border-green-800 transition-colors">
             <div className="flex items-center mb-2">
                 <div className="p-2 bg-green-900/30 rounded-full mr-3 border border-green-900 text-green-500">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                     <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                   </svg>
                 </div>
                 <div className="flex-1">
                  <div className="flex justify-between items-end">
                    <div className="text-xs text-gray-400 uppercase tracking-wider font-bold">Ketangkasan</div>
                    <div className="font-bold text-lg text-green-400 drop-shadow">{player.stats.agility}</div>
                  </div>
                </div>
            </div>
             {/* Visual Bar for Agility */}
             <div className="w-full bg-gray-950 h-2 rounded-full overflow-hidden border border-gray-700 shadow-inner">
                 <div 
                    className="h-full bg-gradient-to-r from-green-900 via-green-600 to-green-500 transition-all duration-700 ease-out shadow-[0_0_8px_rgba(34,197,94,0.6)]" 
                    style={{ width: `${Math.min(100, (player.stats.agility / 50) * 100)}%` }}
                 ></div>
            </div>
             <div className="flex justify-between mt-1 px-1">
               <span className="text-[10px] text-gray-500 italic">Kecepatan & Hindar</span>
               <span className="text-[10px] text-green-400 font-mono">Bonus Dadu: +{Math.floor(player.stats.agility / 2)}</span>
            </div>
          </div>
        </div>

        {/* Mini Map */}
        <div className="mb-4">
          <h3 className="text-yellow-500 font-bold mb-3 rpg-font border-b border-gray-700 pb-1 flex justify-between">
            <span>Peta Wilayah</span>
            <span className="text-xs text-gray-500 font-sans mt-1">Ditemukan: {visitedLocations.length}</span>
          </h3>
          <div className="grid grid-cols-4 gap-2 bg-gray-900 p-2 rounded border border-gray-700">
            {Array.from({ length: MAP_SIZE }).map((_, i) => {
              const visitedLoc = visitedIndices.find(v => v.index === i);
              const isCurrent = i === currentMapIndex;
              const isVisited = !!visitedLoc;
              
              return (
                <div 
                  key={i}
                  title={isVisited ? visitedLoc?.name : "Belum Terjelajah"}
                  className={`
                    aspect-square rounded-sm border relative transition-all duration-500
                    ${isVisited ? getBiomeColor(visitedLoc?.name || '') : 'bg-gray-800 border-gray-700 opacity-30'}
                    ${isCurrent ? 'ring-2 ring-yellow-400 z-10 scale-110' : ''}
                  `}
                >
                  {isCurrent && (
                     <div className="absolute inset-0 flex items-center justify-center">
                       <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                     </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Inventory & Sell */}
        <div className="mb-4 overflow-y-auto max-h-40">
          <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-1">
             <h3 className="text-yellow-500 font-bold rpg-font">Inventoris</h3>
             <div className="flex gap-1">
               <button 
                 onClick={() => setShowShopModal(true)}
                 className="text-xs bg-green-900/50 hover:bg-green-800 text-green-200 px-2 py-1 rounded border border-green-700 transition-colors"
               >
                 + Beli
               </button>
               <button 
                 onClick={() => setShowSellModal(true)}
                 className="text-xs bg-yellow-900/50 hover:bg-yellow-800 text-yellow-200 px-2 py-1 rounded border border-yellow-700 transition-colors"
                 disabled={player.inventory.length === 0}
               >
                 Jual Item
               </button>
             </div>
          </div>
          {player.inventory.length === 0 ? (
            <p className="text-gray-600 text-sm italic">Tas kosong...</p>
          ) : (
            <ul className="text-sm space-y-1">
              {player.inventory.map((item, idx) => (
                <li 
                  key={idx} 
                  className="flex items-center cursor-pointer hover:bg-gray-700/50 p-1 rounded transition-colors group"
                  onClick={() => {
                      playSfx('click');
                      setInspectItem(item);
                  }}
                  title="Klik untuk melihat detail"
                >
                  <span className="w-2 h-2 bg-yellow-600 rounded-full mr-2 group-hover:bg-yellow-400 transition-colors"></span>
                  <span className="group-hover:text-yellow-200">{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Bestiary Section */}
        <div className="mb-4 overflow-y-auto max-h-40">
          <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-1">
             <h3 className="text-red-500 font-bold rpg-font">Bestiary</h3>
             <span className="text-xs text-gray-500 font-sans mt-1">{bestiary.length} Terungkap</span>
          </div>
          {bestiary.length === 0 ? (
            <p className="text-gray-600 text-sm italic text-center py-2">Belum ada monster yang ditemui.</p>
          ) : (
            <div className="space-y-2">
              {bestiary.map((monster, idx) => (
                <div key={idx} className="bg-gray-900/50 p-2 rounded border border-gray-700 flex flex-col gap-1">
                  <div className="flex items-center text-red-400 font-bold text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-2">
                      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                    </svg>
                    {monster.name}
                  </div>
                  <p className="text-xs text-gray-400 italic leading-tight">"{monster.description}"</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Battle Log Section */}
        <div className="flex-1 mb-4 min-h-[150px] flex flex-col">
            <h3 className="text-gray-400 font-bold rpg-font border-b border-gray-700 pb-1 mb-2 text-xs uppercase tracking-widest flex justify-between items-center">
                <span>Riwayat Pertarungan</span>
                {combatLogs.length > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
            </h3>
            <div className="bg-black/50 p-2 rounded border border-gray-700 font-mono text-xs h-full overflow-y-auto scrollbar-hide shadow-inner flex-1">
                 {combatLogs.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-700 italic">Senyap...</div>
                 ) : (
                    combatLogs.map((log, i) => (
                        <div key={i} className="border-b border-gray-800/30 pb-1 mb-1 leading-snug" dangerouslySetInnerHTML={{ __html: log }} />
                    ))
                 )}
                 <div ref={combatLogRef} />
            </div>
        </div>

        {/* Menu Buttons */}
        <div className="mt-auto space-y-2">
            <div className="text-center text-[10px] text-gray-500 italic pb-1">
                Auto-save aktif
            </div>
            <button 
              onClick={handleSave}
              className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded border border-gray-600 transition-colors flex justify-center items-center gap-2"
            >
              <span>{saveStatus || "Simpan Manual"}</span>
            </button>
            <button 
              onClick={onQuit}
              className="w-full py-2 bg-red-900/50 hover:bg-red-900/80 text-red-200 rounded border border-red-800 transition-colors flex justify-center items-center gap-2"
            >
              <span>Keluar ke Menu</span>
            </button>
        </div>
      </div>

      {/* Inspect Modal */}
      {inspectItem && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 border-2 border-blue-500 rounded-lg p-6 max-w-sm w-full shadow-2xl animate-fade-in relative">
                 <button 
                    onClick={() => setInspectItem(null)}
                    className="absolute top-2 right-2 text-gray-500 hover:text-white"
                 >
                    ✕
                 </button>
                <h3 className="text-xl text-blue-400 rpg-font mb-2 text-center border-b border-gray-700 pb-2">
                    {inspectItem}
                </h3>
                <p className="text-gray-300 text-sm italic text-center mb-6 leading-relaxed">
                    "{getItemDescription(inspectItem)}"
                </p>
                <button 
                    onClick={() => setInspectItem(null)}
                    className="w-full py-2 bg-blue-900/50 hover:bg-blue-800 border border-blue-700 text-blue-200 rounded transition-colors"
                >
                    Tutup
                </button>
            </div>
        </div>
      )}

      {/* Shop Modal */}
      {showShopModal && (
        <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 border-2 border-green-700 rounded-lg p-6 max-w-md w-full shadow-2xl animate-fade-in relative max-h-[80vh] flex flex-col">
                 <button 
                    onClick={() => setShowShopModal(false)}
                    className="absolute top-2 right-2 text-gray-500 hover:text-white"
                 >
                    ✕
                 </button>
                <h3 className="text-xl text-green-400 rpg-font mb-2 text-center border-b border-gray-700 pb-2 flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                       <path d="M2.25 2.25a.75.75 0 0 0 0 1.5h1.386c.17 0 .318.114.362.278l2.558 9.592a3.752 3.752 0 0 0-2.806 3.63c0 .414.336.75.75.75h15.75a.75.75 0 0 0 0-1.5H5.378A2.25 2.25 0 0 1 7.5 15h11.218a.75.75 0 0 0 .674-.421 60.358 60.358 0 0 0 2.96-7.228.75.75 0 0 0-.525-.965A60.864 60.864 0 0 0 5.68 4.509l-.232-.867A1.875 1.875 0 0 0 3.636 2.25H2.25ZM3.75 20.25a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM16.5 20.25a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" />
                    </svg>
                    Toko Penjelajah
                </h3>
                <div className="text-center text-yellow-500 mb-4 font-bold border-b border-gray-700 pb-2">
                    Gold Anda: {player.gold} G
                </div>
                <div className="overflow-y-auto pr-1 flex-1 space-y-3">
                    {SHOP_ITEMS.map((item, idx) => {
                        const canAfford = player.gold >= item.price;
                        return (
                            <div key={idx} className="flex justify-between items-center bg-gray-900/50 p-3 rounded border border-gray-700">
                                <div className="flex-1">
                                    <div className="font-bold text-green-200">{item.name}</div>
                                    <div className="text-xs text-gray-400 italic">{item.desc}</div>
                                </div>
                                <button
                                    onClick={() => handleBuyItem(item)}
                                    disabled={!canAfford}
                                    className={`ml-3 px-3 py-1.5 rounded text-xs font-bold transition-colors flex flex-col items-center min-w-[60px] ${
                                        canAfford 
                                        ? 'bg-green-900 text-green-300 hover:bg-green-800 border border-green-700' 
                                        : 'bg-gray-800 text-gray-500 border border-gray-600 cursor-not-allowed opacity-50'
                                    }`}
                                >
                                    <span>Beli</span>
                                    <span>{item.price} G</span>
                                </button>
                            </div>
                        );
                    })}
                </div>
                <button 
                    onClick={() => setShowShopModal(false)}
                    className="mt-4 w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded border border-gray-500 transition-colors"
                >
                    Tutup
                </button>
            </div>
        </div>
      )}

      {/* Combat Mini-Game Modal */}
      {showCombatModal && combatEncounter && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-fade-in">
             <div className="bg-gray-900 border-4 border-red-800 rounded-xl p-6 max-w-lg w-full shadow-[0_0_50px_rgba(220,38,38,0.3)] relative flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className={`text-center mb-4 shrink-0 transition-all duration-500 relative ${combatPhase === 'enemy_turn' ? 'scale-110' : ''}`}>
                    {/* CRITICAL FLASH OVERLAY */}
                    {enemyFlash && <div className="absolute inset-0 bg-white mix-blend-overlay z-50 animate-pulse opacity-80 rounded-lg"></div>}
                    
                    <h3 className="text-2xl rpg-font text-red-500 mb-1 tracking-widest animate-pulse">PERTARUNGAN</h3>
                    
                    {/* Enemy Name & Visuals */}
                    <div className={`relative inline-block transition-all duration-300 ${combatPhase === 'enemy_turn' ? 'drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]' : ''}`}>
                         <div className={`text-lg font-bold border-b border-red-900 pb-1 transition-colors ${combatPhase === 'enemy_turn' ? 'text-red-400' : 'text-yellow-500'}`}>
                             {combatEncounter.enemyName}
                         </div>
                         {combatPhase === 'enemy_turn' && (
                             <>
                                <div className="absolute -right-6 top-1/2 -translate-y-1/2 text-red-500 animate-bounce font-bold text-xl">⚠️</div>
                                <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-red-500 animate-bounce font-bold text-xl">⚠️</div>
                             </>
                         )}
                    </div>
                    
                    {/* Enemy HP Bar */}
                    <div className={`mt-2 w-full bg-gray-800 rounded-full h-4 border relative overflow-hidden transition-colors duration-300 ${combatPhase === 'enemy_turn' ? 'border-red-500 shadow-[0_0_8px_rgba(220,38,38,0.5)]' : 'border-gray-600'}`}>
                        <div 
                           className="h-full bg-red-600 transition-all duration-500"
                           style={{ width: `${Math.max(0, (enemyHp / combatEncounter.maxHp) * 100)}%`}}
                        ></div>
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">
                            {enemyHp} / {combatEncounter.maxHp} HP
                        </span>
                    </div>
                </div>

                {/* Combat Area Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4 shrink-0">
                    {/* Stats */}
                    <div className="bg-gray-800 p-2 rounded text-center border border-gray-700">
                        <div className="text-[10px] text-gray-400 uppercase">Target (DC)</div>
                        <div className="text-xl font-bold text-white">{combatEncounter.difficulty}</div>
                    </div>
                     <div className="bg-gray-800 p-2 rounded text-center border border-gray-700">
                        <div className="text-[10px] text-gray-400 uppercase">Musuh DMG</div>
                        <div className="text-xl font-bold text-red-500">{combatEncounter.damage}</div>
                    </div>
                </div>

                {/* Combat Log */}
                <div className="bg-black/80 border border-gray-700 rounded p-3 h-40 overflow-y-auto mb-4 font-mono text-sm leading-relaxed space-y-1 shadow-inner scrollbar-hide">
                    {combatLogs.map((log, i) => (
                        <div key={i} className="border-b border-gray-800/50 pb-1" dangerouslySetInnerHTML={{ __html: log }} />
                    ))}
                    <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })}></div>
                </div>

                {/* Dice & Action Area */}
                <div className="flex flex-col items-center justify-center grow relative">
                    
                    {/* Floating Combat Text Container (Absolute) */}
                    {floatingTexts.map(ft => (
                        <div 
                            key={ft.id}
                            className={`absolute z-50 animate-float-up pointer-events-none ${getFloatingTextStyle(ft.type)}`}
                            style={{ 
                                top: `calc(30% + ${ft.y}px)`, 
                                left: `calc(50% + ${ft.x}px)`,
                                transform: 'translate(-50%, -50%)'
                            }}
                        >
                            {ft.text}
                        </div>
                    ))}

                    {/* Dice Display */}
                    <div className="mb-4 h-20 flex items-center justify-center relative">
                         {diceValue !== null ? (
                             <div className={`
                                 w-16 h-16 bg-white text-black text-3xl font-bold flex items-center justify-center rounded-lg border-4 border-gray-300 shadow-2xl
                                 ${isRolling ? 'animate-shake' : 'animate-bounce'}
                             `}>
                                 {diceValue}
                             </div>
                         ) : (
                             <div className="text-gray-500 text-sm italic">
                                 {combatPhase === 'player_turn' ? 'Giliran Anda...' : combatPhase === 'enemy_turn' ? 'Musuh Menyerang!' : 'Pertarungan Selesai'}
                             </div>
                         )}
                    </div>

                    {/* Action Buttons */}
                    <div className="w-full space-y-2">
                        {combatPhase === 'player_turn' && (
                            <button
                                onClick={handlePlayerAttack}
                                disabled={isRolling || isAutoCombat}
                                className="w-full py-3 bg-red-700 hover:bg-red-600 text-white font-bold rounded uppercase tracking-widest shadow-[0_0_15px_rgba(220,38,38,0.4)] disabled:opacity-50 disabled:cursor-wait transition-transform hover:scale-105"
                            >
                                {isRolling ? '...' : `Serang (${combatEncounter.statUsed.toUpperCase()})`}
                            </button>
                        )}
                        
                        {combatPhase === 'enemy_turn' && (
                             <button
                                onClick={handlePlayerDodge}
                                disabled={isRolling || isAutoCombat}
                                className="w-full py-3 bg-blue-700 hover:bg-blue-600 text-white font-bold rounded uppercase tracking-widest shadow-[0_0_15px_rgba(37,99,235,0.4)] disabled:opacity-50 disabled:cursor-wait transition-transform hover:scale-105 animate-pulse"
                            >
                                {isRolling ? '...' : 'HINDAR (AGILITY)!'}
                            </button>
                        )}

                        {(combatPhase === 'victory' || combatPhase === 'defeat') && (
                            <div className={`text-center font-bold text-2xl ${combatPhase === 'victory' ? 'text-green-500' : 'text-red-500'}`}>
                                {combatPhase === 'victory' ? 'VICTORY!' : 'DEFEATED'}
                            </div>
                        )}
                        
                        {(combatPhase === 'player_turn' || combatPhase === 'enemy_turn') && (
                            <button
                                onClick={() => setIsAutoCombat(!isAutoCombat)}
                                className={`w-full py-2 mt-2 rounded border font-mono text-xs uppercase tracking-widest transition-all ${
                                    isAutoCombat 
                                    ? 'bg-yellow-900/50 border-yellow-500 text-yellow-500 animate-pulse' 
                                    : 'bg-gray-800 border-gray-600 text-gray-500 hover:border-gray-400'
                                }`}
                            >
                                {isAutoCombat ? '⚠️ Auto Combat: ON' : 'Auto Combat: OFF'}
                            </button>
                        )}
                    </div>
                </div>
             </div>
        </div>
      )}

      {/* Right Panel: Story & Interaction */}
      <div className="w-full md:w-3/4 flex flex-col relative bg-black">
        
        {/* Visual Header with Transition */}
        <div className="h-48 md:h-64 w-full relative overflow-hidden shrink-0 border-b border-gray-700 bg-black">
           <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent z-10"></div>
           
           <img 
             key={stableImage} // Trigger keyframe animation when src changes
             src={stableImage} 
             alt="Scene" 
             className={`w-full h-full object-cover transition-opacity duration-1000 ${showContent ? 'opacity-60' : 'opacity-0'}`}
           />
           
           <div className={`absolute bottom-4 left-6 z-20 transition-all duration-700 ${showContent ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
             <span className="bg-black/50 px-2 py-1 text-xs text-yellow-300 border border-yellow-700 rounded backdrop-blur-sm">
               Lokasi: {visualKeyword.charAt(0).toUpperCase() + visualKeyword.slice(1)}
             </span>
           </div>
        </div>

        {/* Narrative Text Area */}
        <div 
          ref={scrollRef}
          className="flex-1 p-8 overflow-y-auto scrollbar-hide bg-gray-900 relative"
        >
          {/* Loading Spinner */}
          <div className={`absolute inset-0 flex flex-col items-center justify-center space-y-4 bg-gray-900 z-20 transition-opacity duration-500 ${isLoading ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
             <div className="text-yellow-500 text-xl rpg-font animate-pulse">Sedang Merajut Takdir...</div>
             <div className="w-16 h-16 border-4 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
          </div>

          {/* Replay/Reload Text Button */}
          <div className={`absolute top-2 right-4 z-30 transition-opacity duration-300 ${isLoading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
             <button
               onClick={handleReplayNarrative}
               className="p-1.5 text-gray-500 hover:text-yellow-400 transition-colors bg-gray-900/80 rounded-full border border-gray-700 hover:border-yellow-600"
               title="Baca Ulang Narasi"
             >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
             </button>
          </div>

          {/* Text Content with Animation */}
          <div className={`transition-opacity duration-700 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
            <div className="prose prose-invert prose-lg max-w-none animate-fade-in">
              <p className="whitespace-pre-wrap leading-relaxed text-gray-300 font-serif text-lg">
                {narrative}
              </p>
            </div>
          </div>
        </div>

        {/* Choices Area */}
        <div className={`p-6 bg-gray-800 border-t border-gray-700 shrink-0 transition-all duration-500 ${showContent ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
            {isLoading ? (
               // Skeleton buttons to prevent layout shift before opacity 0 kicks in fully or during transition
               Array(2).fill(0).map((_, i) => (
                 <div key={i} className="h-16 bg-gray-700 rounded opacity-50 animate-pulse"></div>
               ))
            ) : (
              choices.map((choice, index) => (
                <button
                  key={index}
                  onClick={() => handleChoiceClick(choice)}
                  disabled={!showContent || (combatEncounter !== undefined && combatEncounter !== null)}
                  className={`
                    group relative w-full text-left p-4 rounded-lg border-2 transition-all duration-300 overflow-hidden shadow-md
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale
                    ${choice.isCritical 
                      ? 'bg-gradient-to-br from-red-950/90 to-red-900/50 border-red-700 hover:border-red-500 hover:shadow-[0_0_20px_rgba(220,38,38,0.3)]' 
                      : 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-600 hover:border-yellow-500 hover:shadow-[0_0_15px_rgba(234,179,8,0.2)]'
                    }
                  `}
                >
                  {/* Animated Background Overlay for Hover */}
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${
                    choice.isCritical ? 'bg-red-600/10' : 'bg-yellow-500/5'
                  }`}></div>
                  
                  <div className="relative z-10 flex items-start gap-3">
                    {/* Icon / Index */}
                    <div className={`flex-shrink-0 mt-0.5 ${choice.isCritical ? 'text-red-500' : 'text-yellow-600 group-hover:text-yellow-400'}`}>
                      {choice.isCritical ? (
                         <div className="bg-red-950 border border-red-800 rounded-full p-1.5 animate-pulse">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                              <path fillRule="evenodd" d="M10.5 3.798v2.97A10.5 10.5 0 1 1 2.25 16.517l.223-1.116 3.515-.703v1.528c0 1.056.884 1.889 1.93 1.823 1.579-.1 3.033-.942 3.58-2.22l.504-1.176 1.85 4.316A1.5 1.5 0 0 0 15.228 20h.016a1.5 1.5 0 0 0 1.378-.962l2.316-6.175.69-1.841 2.37-6.319a.75.75 0 0 0-1.002-.95l-7.486 2.807-2.92-1.168-3.078 1.408zm-.72 2.766L6.594 7.64l1.63 1.631.78-.781a.75.75 0 0 1 1.06 0l.781.781 2.067-2.067-3.132 1.408V6.564zM3.805 15.657l-1.085-3.616a.75.75 0 0 1 .536-.93l7.487-2.807 2.28 2.28-.78.78a.75.75 0 0 0 0 1.061l.781.781-1.631 1.631-2.067-2.067 1.631-1.631-.781-.781a.75.75 0 0 0-1.06 0l-.781.78 1.63 1.632-1.076 1.075-2.22-4.14z" clipRule="evenodd" />
                              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" clipRule="evenodd" />
                            </svg>
                         </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full border border-gray-600 bg-gray-800 flex items-center justify-center font-mono font-bold group-hover:border-yellow-500 transition-colors">
                           {index + 1}
                        </div>
                      )}
                    </div>
                    
                    {/* Text Content */}
                    <div className="flex-1 min-w-0">
                      <div className={`font-serif text-lg leading-snug mb-1 ${choice.isCritical ? 'text-red-100 font-bold' : 'text-gray-200 group-hover:text-yellow-50'}`}>
                        {choice.text}
                      </div>
                      
                      {choice.isCritical && (
                         <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase bg-red-950/80 text-red-400 border border-red-900/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                            Konsekuensi Fatal
                         </div>
                      )}
                    </div>

                    {/* Arrow Indicator on Hover (Desktop) */}
                    <div className="hidden md:block opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-[-10px] group-hover:translate-x-0 self-center text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                          <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10z" clipRule="evenodd" />
                        </svg>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default GameScreen;