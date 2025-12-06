export enum GameState {
  MENU = 'MENU',
  CHARACTER_SELECTION = 'CHARACTER_SELECTION',
  GENRE_SELECTION = 'GENRE_SELECTION',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export enum PlayerClass {
  WARRIOR = 'Ksatria',
  MAGE = 'Penyihir',
  ROGUE = 'Pencuri',
  CLERIC = 'Tabib'
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  strength: number;
  intelligence: number;
  agility: number;
}

export interface Player {
  name: string;
  gender: 'Pria' | 'Wanita';
  class: PlayerClass;
  stats: PlayerStats;
  inventory: string[];
  gold: number;
  level: number;
  currentXp: number;
  maxXp: number;
}

export interface Choice {
  text: string;
  isCritical?: boolean;
}

export interface CombatEncounter {
  enemyName: string;
  difficulty: number; // The target number to beat (DC)
  hp: number; // Enemy Health
  maxHp: number; 
  damage: number; // Enemy Attack Damage
  statUsed: 'strength' | 'intelligence' | 'agility';
  description: string;
  attackDescription: string; // E.g., "Semburan Api", "Tebasan Cakar"
}

export interface MonsterEntry {
  name: string;
  description: string;
}

export interface GameResponse {
  narrative: string;
  choices: Choice[];
  visual_prompt_keyword: string; // Keyword for image generation
  combat_encounter?: CombatEncounter | null; // Trigger for mini-game
  stat_updates?: {
    hp?: number;
    mp?: number;
    gold_change?: number;
    item_gained?: string;
    item_lost?: string;
    xp_gained?: number;
  };
  is_game_over: boolean;
  is_victory: boolean;
}

export interface HistoryItem {
  role: 'user' | 'model';
  text: string;
}

export interface SaveData {
  player: Player;
  history: HistoryItem[];
  currentNarrative: string;
  currentChoices: Choice[];
  visualKeyword: string;
  visitedLocations: string[];
  bestiary: MonsterEntry[];
  genre: string;
  timestamp: number;
}