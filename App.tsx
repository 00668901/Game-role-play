import React, { useState, useEffect, useRef } from 'react';
import { GameState, Player, PlayerClass, HistoryItem, SaveData, Choice, CombatEncounter, MonsterEntry } from './types';
import CharacterSelector, { BASE_STATS } from './components/CharacterSelector';
import GameScreen from './components/GameScreen';
import GameOverScreen from './components/GameOverScreen'; // Import new component
import { generateStory } from './services/geminiService';

const SAVE_KEY = 'hikayat_takdir_save';

const GENRES = [
  "High Fantasy (Sihir, Naga, Kerajaan)",
  "Dark Fantasy (Horor, Gothic, Brutal)",
  "Cyberpunk (Masa Depan, Neon, Teknologi)",
  "Eldritch Horror (Kosmik, Gila, Misteri)",
  "Isekai (Dunia Lain, Overpowered, Petualangan)"
];

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [player, setPlayer] = useState<Player | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>("Dark Fantasy");
  
  // Game Content State
  const [currentNarrative, setCurrentNarrative] = useState<string>("");
  const [currentChoices, setCurrentChoices] = useState<Choice[]>([]);
  const [visualKeyword, setVisualKeyword] = useState<string>("fantasy");
  const [visitedLocations, setVisitedLocations] = useState<string[]>([]);
  const [bestiary, setBestiary] = useState<MonsterEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isVictory, setIsVictory] = useState<boolean>(false);
  const [hasSaveFile, setHasSaveFile] = useState<boolean>(false);
  const [combatEncounter, setCombatEncounter] = useState<CombatEncounter | null>(null);

  // Ref to track if initial load is done to prevent overwriting save with empty state
  const isLoaded = useRef(false);

  // Check for save file on mount
  useEffect(() => {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      setHasSaveFile(true);
    }
    isLoaded.current = true;
  }, []);

  // Initialize Game Flow
  const startNewGame = () => {
    if (hasSaveFile) {
      if (!window.confirm("Memulai permainan baru akan menimpa penyimpanan yang ada. Lanjutkan?")) {
        return;
      }
    }
    setGameState(GameState.CHARACTER_SELECTION);
    setHistory([]);
    setPlayer(null);
    setVisitedLocations([]);
    setBestiary([]);
    setCombatEncounter(null);
  };

  const saveGame = () => {
    if (!player) return;
    const saveData: SaveData = {
      player,
      history,
      currentNarrative,
      currentChoices,
      visualKeyword,
      visitedLocations,
      bestiary,
      genre: selectedGenre,
      timestamp: Date.now()
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    setHasSaveFile(true);
  };

  // Auto Save Logic
  useEffect(() => {
    if (isLoaded.current && gameState === GameState.PLAYING && player) {
      saveGame();
    }
  }, [history, player, gameState, visualKeyword, bestiary]);

  const loadGame = () => {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (!saved) return;
      
      const parsedData: any = JSON.parse(saved);
      
      // Backward Compatibility Checks
      const loadedPlayer = parsedData.player;
      if (loadedPlayer) {
        if (typeof loadedPlayer.level === 'undefined') {
          loadedPlayer.level = 1;
          loadedPlayer.currentXp = 0;
          loadedPlayer.maxXp = 100;
        }
        if (typeof loadedPlayer.gold === 'undefined') {
          loadedPlayer.gold = 50;
        }
        if (typeof loadedPlayer.gender === 'undefined') {
          loadedPlayer.gender = 'Pria'; // Default for old saves
        }
      }

      let loadedChoices: Choice[] = [];
      if (Array.isArray(parsedData.currentChoices)) {
        if (parsedData.currentChoices.length > 0 && typeof parsedData.currentChoices[0] === 'string') {
          loadedChoices = parsedData.currentChoices.map((c: string) => ({ text: c, isCritical: false }));
        } else {
          loadedChoices = parsedData.currentChoices;
        }
      }

      setPlayer(loadedPlayer);
      setHistory(parsedData.history);
      setCurrentNarrative(parsedData.currentNarrative);
      setCurrentChoices(loadedChoices);
      setVisualKeyword(parsedData.visualKeyword);
      setVisitedLocations(parsedData.visitedLocations || []); 
      setBestiary(parsedData.bestiary || []);
      setSelectedGenre(parsedData.genre || "Dark Fantasy");
      setCombatEncounter(null); // Clear combat on load
      setGameState(GameState.PLAYING);
    } catch (error) {
      console.error("Failed to load save file", error);
      alert("Gagal memuat data penyimpanan.");
    }
  };

  const quitGame = () => {
    if (window.confirm("Apakah Anda yakin ingin keluar ke Menu Utama? Progres Anda telah tersimpan otomatis.")) {
      setGameState(GameState.MENU);
    }
  };

  // Step 1: Character Selected -> Go to Genre Selection
  const handleCharacterSelect = (pClass: PlayerClass, name: string, gender: 'Pria' | 'Wanita') => {
    const newPlayer: Player = {
      name,
      gender,
      class: pClass,
      stats: { ...BASE_STATS[pClass] },
      inventory: ["Peta Kuno", "Ransum Makanan (2)"],
      gold: 50, // Starting gold
      level: 1,
      currentXp: 0,
      maxXp: 100
    };
    setPlayer(newPlayer);
    setGameState(GameState.GENRE_SELECTION);
  };

  // Step 2: Genre Selected -> Start Playing
  const handleGenreSelect = (genre: string) => {
    setSelectedGenre(genre);
    setGameState(GameState.PLAYING);
    if (player) {
       handleGameTurn(player, "Memulai petualangan", [], genre);
    }
  };

  const handleGameTurn = async (
    currentPlayer: Player, 
    choice: string, 
    currentHistory: HistoryItem[], 
    overrideGenre?: string
  ) => {
    setIsLoading(true);
    // If we were in combat, clear it now since we are proceeding
    setCombatEncounter(null);

    const activeGenre = overrideGenre || selectedGenre;
    
    // Add user choice to history
    const updatedHistory = [...currentHistory];
    if (updatedHistory.length > 0) {
      updatedHistory.push({ role: 'user', text: choice });
    }

    // Call API
    const response = await generateStory(currentPlayer, choice, updatedHistory, activeGenre);

    let narrative = response.narrative;
    
    // Calculate Stats, XP, Gold
    const updatedPlayer = { ...currentPlayer };
    
    if (response.stat_updates) {
      // Basic Stats
      if (response.stat_updates.hp) {
        updatedPlayer.stats.hp = Math.min(updatedPlayer.stats.maxHp, Math.max(0, updatedPlayer.stats.hp + response.stat_updates.hp));
      }
      if (response.stat_updates.mp) {
        updatedPlayer.stats.mp = Math.min(updatedPlayer.stats.maxMp, Math.max(0, updatedPlayer.stats.mp + response.stat_updates.mp));
      }
      if (response.stat_updates.gold_change) {
        updatedPlayer.gold = Math.max(0, updatedPlayer.gold + response.stat_updates.gold_change);
      }

      // Inventory
      if (response.stat_updates.item_gained) {
        updatedPlayer.inventory = [...updatedPlayer.inventory, response.stat_updates.item_gained];
      }
      if (response.stat_updates.item_lost) {
        updatedPlayer.inventory = updatedPlayer.inventory.filter(i => i !== response.stat_updates?.item_lost);
      }

      // XP & Level Up
      if (response.stat_updates.xp_gained) {
        updatedPlayer.currentXp += response.stat_updates.xp_gained;
        while (updatedPlayer.currentXp >= updatedPlayer.maxXp) {
          updatedPlayer.currentXp -= updatedPlayer.maxXp;
          updatedPlayer.level += 1;
          updatedPlayer.maxXp = Math.floor(updatedPlayer.maxXp * 1.5);
          updatedPlayer.stats.maxHp += 20;
          updatedPlayer.stats.hp = updatedPlayer.stats.maxHp;
          updatedPlayer.stats.maxMp += 10;
          updatedPlayer.stats.mp = updatedPlayer.stats.maxMp;
          updatedPlayer.stats.strength += 2;
          updatedPlayer.stats.intelligence += 2;
          updatedPlayer.stats.agility += 2;
          narrative += `\n\n[NAIK LEVEL! Level ${updatedPlayer.level} tercapai!]`;
        }
      }
    }

    setPlayer(updatedPlayer);
    setCurrentNarrative(narrative);
    setCurrentChoices(response.choices);
    setCombatEncounter(response.combat_encounter || null); 
    
    // Update Bestiary if encounter happens
    if (response.combat_encounter) {
      setBestiary(prev => {
        const exists = prev.some(m => m.name === response.combat_encounter!.enemyName);
        if (exists) return prev;
        return [...prev, {
          name: response.combat_encounter!.enemyName,
          description: response.combat_encounter!.description
        }];
      });
    }
    
    const newKeyword = response.visual_prompt_keyword || "fantasy";
    setVisualKeyword(newKeyword);
    
    if (!visitedLocations.includes(newKeyword)) {
      setVisitedLocations(prev => [...prev, newKeyword]);
    }

    updatedHistory.push({ role: 'model', text: narrative });
    const trimmedHistory = updatedHistory.slice(-20); 
    setHistory(trimmedHistory);

    if (updatedPlayer.stats.hp <= 0 || response.is_game_over) {
      setGameState(GameState.GAME_OVER);
    } else if (response.is_victory) {
      setIsVictory(true);
      setGameState(GameState.VICTORY);
    }

    setIsLoading(false);
  };

  const onMakeChoice = (choice: string) => {
    if (player) {
      handleGameTurn(player, choice, history);
    }
  };

  const onUpdatePlayer = (updated: Player) => {
      setPlayer(updated);
  };

  // Render Logic
  if (gameState === GameState.MENU) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[url('https://picsum.photos/id/1022/1920/1080')] bg-cover bg-center text-white relative">
        <div className="absolute inset-0 bg-black/70"></div>
        <div className="relative z-10 text-center p-8 border-4 border-double border-yellow-600 bg-black/50 backdrop-blur-sm rounded-lg animate-fade-in max-w-2xl">
          <h1 className="text-6xl font-bold mb-4 rpg-font text-yellow-500 tracking-widest drop-shadow-lg">HIKAYAT TAKDIR</h1>
          <p className="mb-8 text-xl text-gray-300 font-serif italic">"Di mana setiap pilihan mengukir sejarah baru..."</p>
          
          <div className="flex flex-col gap-4 w-full max-w-xs mx-auto">
            <button 
              onClick={startNewGame}
              className="px-10 py-4 bg-red-900 hover:bg-red-700 text-white font-bold rounded border border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.5)] transition-all transform hover:scale-105 uppercase tracking-wider"
            >
              Mulai Cerita Baru
            </button>
            
            {hasSaveFile && (
              <button 
                onClick={loadGame}
                className="px-10 py-4 bg-gray-800 hover:bg-gray-700 text-yellow-500 font-bold rounded border border-yellow-600 shadow-lg transition-all transform hover:scale-105 uppercase tracking-wider"
              >
                Lanjutkan Petualangan
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (gameState === GameState.CHARACTER_SELECTION) {
    return <CharacterSelector onSelect={handleCharacterSelect} />;
  }

  if (gameState === GameState.GENRE_SELECTION) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-900 text-white animate-fade-in">
             <h2 className="text-4xl rpg-font text-yellow-500 mb-8 text-center">Pilih Genre Cerita</h2>
             <div className="grid grid-cols-1 gap-4 w-full max-w-md">
                 {GENRES.map((g) => (
                     <button
                        key={g}
                        onClick={() => handleGenreSelect(g)}
                        className="p-4 bg-gray-800 border border-gray-600 hover:border-yellow-500 hover:bg-gray-700 rounded text-lg transition-all text-left"
                     >
                        {g}
                     </button>
                 ))}
             </div>
        </div>
      );
  }

  if (gameState === GameState.PLAYING && player) {
    return (
      <GameScreen 
        player={player}
        narrative={currentNarrative}
        choices={currentChoices}
        combatEncounter={combatEncounter}
        visualKeyword={visualKeyword}
        visitedLocations={visitedLocations}
        bestiary={bestiary}
        onMakeChoice={onMakeChoice}
        isLoading={isLoading}
        onSave={saveGame}
        onQuit={quitGame}
        onUpdatePlayer={onUpdatePlayer}
      />
    );
  }

  // Updated Game Over / Victory Rendering
  if (gameState === GameState.GAME_OVER || gameState === GameState.VICTORY) {
    return (
      <GameOverScreen 
        isVictory={gameState === GameState.VICTORY}
        narrative={currentNarrative}
        onRestart={() => setGameState(GameState.MENU)}
      />
    );
  }

  return <div>Loading...</div>;
};

export default App;