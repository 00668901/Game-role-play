import React from 'react';
import { PlayerClass, PlayerStats, Player } from '../types';

interface CharacterSelectorProps {
  onSelect: (pClass: PlayerClass, name: string, gender: 'Pria' | 'Wanita') => void;
}

const CLASS_DESCRIPTIONS: Record<PlayerClass, string> = {
  [PlayerClass.WARRIOR]: "Ahli pertarungan jarak dekat. Kuat dan tahan banting.",
  [PlayerClass.MAGE]: "Penguasa seni arkana. Rapuh namun mematikan dengan sihir.",
  [PlayerClass.ROGUE]: "Cepat dan licik. Ahli dalam serangan mendadak dan menghindar.",
  [PlayerClass.CLERIC]: "Pelindung suci. Seimbang dalam pertahanan dan penyembuhan."
};

const BASE_STATS: Record<PlayerClass, PlayerStats> = {
  [PlayerClass.WARRIOR]: { hp: 120, maxHp: 120, mp: 30, maxMp: 30, strength: 10, intelligence: 3, agility: 5 },
  [PlayerClass.MAGE]: { hp: 70, maxHp: 70, mp: 100, maxMp: 100, strength: 2, intelligence: 10, agility: 6 },
  [PlayerClass.ROGUE]: { hp: 90, maxHp: 90, mp: 50, maxMp: 50, strength: 6, intelligence: 5, agility: 10 },
  [PlayerClass.CLERIC]: { hp: 100, maxHp: 100, mp: 80, maxMp: 80, strength: 5, intelligence: 7, agility: 4 },
};

const CharacterSelector: React.FC<CharacterSelectorProps> = ({ onSelect }) => {
  const [selectedClass, setSelectedClass] = React.useState<PlayerClass | null>(null);
  const [name, setName] = React.useState('');
  const [gender, setGender] = React.useState<'Pria' | 'Wanita'>('Pria');

  const handleConfirm = () => {
    if (selectedClass && name.trim()) {
      onSelect(selectedClass, name, gender);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-900 text-white animate-fade-in overflow-y-auto">
      <h2 className="text-4xl rpg-font text-yellow-500 mb-6 text-center border-b-2 border-yellow-500 pb-2">
        Identitas Pahlawan
      </h2>
      
      <div className="w-full max-w-2xl bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-xl mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-gray-400 mb-2 font-bold">Nama</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Masukkan nama..."
              className="w-full bg-gray-900 border border-gray-600 rounded px-4 py-2 text-yellow-100 focus:outline-none focus:border-yellow-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-gray-400 mb-2 font-bold">Gender</label>
            <div className="flex space-x-4">
              <button
                onClick={() => setGender('Pria')}
                className={`flex-1 py-2 rounded border transition-all ${gender === 'Pria' ? 'bg-blue-900 border-blue-500 text-blue-100' : 'bg-gray-900 border-gray-600 text-gray-500'}`}
              >
                Pria
              </button>
              <button
                onClick={() => setGender('Wanita')}
                className={`flex-1 py-2 rounded border transition-all ${gender === 'Wanita' ? 'bg-pink-900 border-pink-500 text-pink-100' : 'bg-gray-900 border-gray-600 text-gray-500'}`}
              >
                Wanita
              </button>
            </div>
          </div>
        </div>
      </div>

      <h3 className="text-2xl rpg-font text-gray-300 mb-4">Pilih Kelas</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl mb-8">
        {Object.values(PlayerClass).map((pClass) => (
          <div 
            key={pClass}
            onClick={() => setSelectedClass(pClass)}
            className={`p-6 border-2 rounded-lg cursor-pointer transition-all transform hover:scale-105 ${
              selectedClass === pClass 
                ? 'border-yellow-500 bg-gray-800 shadow-[0_0_15px_rgba(234,179,8,0.5)]' 
                : 'border-gray-700 bg-gray-900 hover:border-gray-500'
            }`}
          >
            <h3 className="text-2xl rpg-font text-yellow-100 mb-2">{pClass}</h3>
            <p className="text-sm text-gray-400 mb-4 h-10">{CLASS_DESCRIPTIONS[pClass]}</p>
            
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
              <div>HP: {BASE_STATS[pClass].hp}</div>
              <div>MP: {BASE_STATS[pClass].mp}</div>
              <div>STR: {BASE_STATS[pClass].strength}</div>
              <div>INT: {BASE_STATS[pClass].intelligence}</div>
              <div>AGI: {BASE_STATS[pClass].agility}</div>
            </div>
          </div>
        ))}
      </div>

      <button
        disabled={!selectedClass || !name.trim()}
        onClick={handleConfirm}
        className={`px-12 py-4 rounded text-lg font-bold tracking-widest uppercase transition-all mb-8 ${
          (!selectedClass || !name.trim())
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-yellow-700 to-yellow-500 text-gray-900 hover:from-yellow-600 hover:to-yellow-400 shadow-lg transform hover:scale-105'
        }`}
      >
        Lanjut ke Genre
      </button>
    </div>
  );
};

export default CharacterSelector;
export { BASE_STATS };