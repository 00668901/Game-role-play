import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Player, HistoryItem, GameResponse } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    narrative: {
      type: Type.STRING,
      description: "Cerita naratif utama dalam Bahasa Indonesia yang menarik dan imersif.",
    },
    choices: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "Teks pilihan tindakan." },
          isCritical: { 
            type: Type.BOOLEAN, 
            description: "True jika pilihan ini berisiko tinggi, menentukan ending, atau mengubah jalan cerita secara drastis." 
          }
        },
        required: ["text"]
      },
      description: "Daftar 2 hingga 4 pilihan tindakan. KOSONGKAN jika 'combat_encounter' aktif.",
    },
    visual_prompt_keyword: {
      type: Type.STRING,
      description: "Satu kata kunci bahasa Inggris yang menggambarkan suasana adegan (misal: 'dungeon', 'forest', 'monster', 'village').",
    },
    combat_encounter: {
      type: Type.OBJECT,
      nullable: true,
      description: "Isi objek ini HANYA jika pemain bertemu musuh. Buatlah musuh yang bervariasi sesuai Level Pemain.",
      properties: {
        enemyName: { type: Type.STRING, description: "Nama musuh yang unik (misal: 'Gukguk Neraka', 'Penyihir Gila')." },
        difficulty: { type: Type.INTEGER, description: "Target Dadu (DC) untuk memukul. Easy: 8-10, Med: 12-15, Hard: 16-19." },
        hp: { type: Type.INTEGER, description: "Health Point musuh. Sesuaikan dengan level pemain (lihat instruksi)." },
        maxHp: { type: Type.INTEGER, description: "Sama dengan hp awal." },
        damage: { type: Type.INTEGER, description: "Damage musuh ke pemain. Sesuaikan dengan level pemain." },
        statUsed: { type: Type.STRING, enum: ["strength", "intelligence", "agility"], description: "Statistik pemain yang paling logis untuk melawan musuh ini." },
        description: { type: Type.STRING, description: "Deskripsi visual musuh yang menyeramkan atau agung." },
        attackDescription: { type: Type.STRING, description: "Nama serangan khas musuh (misal: 'Semburan Asam', 'Tebasan Ganda')." }
      },
      required: ["enemyName", "difficulty", "hp", "maxHp", "damage", "statUsed", "description", "attackDescription"]
    },
    stat_updates: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        hp: { type: Type.INTEGER, description: "Perubahan HP (Hanya gunakan untuk event narasi, BUKAN hasil combat)." },
        mp: { type: Type.INTEGER, description: "Perubahan MP." },
        gold_change: { type: Type.INTEGER, description: "Perubahan Koin Emas (Gold)." },
        item_gained: { type: Type.STRING, description: "Nama item yang didapatkan (jika ada)." },
        item_lost: { type: Type.STRING, description: "Nama item yang hilang (jika ada)." },
        xp_gained: { type: Type.INTEGER, description: "XP yang didapat dari tindakan ini (10-100 tergantung kesulitan/dampak)." },
      },
    },
    is_game_over: {
      type: Type.BOOLEAN,
      description: "True jika pemain mati atau cerita berakhir buruk.",
    },
    is_victory: {
      type: Type.BOOLEAN,
      description: "True jika pemain mencapai True Ending atau kemenangan besar.",
    },
  },
  required: ["narrative", "choices", "visual_prompt_keyword", "is_game_over", "is_victory"],
};

export const generateStory = async (
  player: Player,
  lastChoice: string,
  history: HistoryItem[],
  genre: string
): Promise<GameResponse> => {
  const model = "gemini-2.5-flash";
  
  const systemInstruction = `
    Anda adalah Game Master (GM) untuk game RPG teks interaktif bernama "Hikayat Takdir".
    
    Setting Permainan:
    - Genre: ${genre}.
    - Bahasa: Indonesia yang sastrawi dan imersif.
    
    Status Pemain:
    - Nama: ${player.name} (${player.class})
    - Level: ${player.level}
    - HP: ${player.stats.hp}/${player.stats.maxHp}
    
    PANDUAN PEMBUATAN MUSUH (COMBAT ENCOUNTER):
    Jika cerita mengarah ke pertarungan, buat 'combat_encounter' dengan spesifikasi berikut berdasarkan Level ${player.level}:
    
    1. TIER 1 (Level 1-3): "Kroco / Binatang Liar"
       - HP: 25 - 45
       - Damage: 5 - 10
       - Difficulty (DC): 8 - 12
       - Contoh: Goblin, Serigala, Preman, Slime, Tikus Raksasa.

    2. TIER 2 (Level 4-7): "Prajurit Terlatih / Monster Menengah"
       - HP: 50 - 100
       - Damage: 12 - 20
       - Difficulty (DC): 13 - 15
       - Contoh: Orc Warrior, Hantu Penasaran, Knight, Golem Batu, Harpy.

    3. TIER 3 (Level 8+): "Boss / Makhluk Legenda"
       - HP: 120 - 250+
       - Damage: 25 - 45
       - Difficulty (DC): 16 - 20
       - Contoh: Naga, Lich King, Demon Lord, Archangel, Kraken.

    VARIASI ARKETIPE MUSUH (Tentukan 'statUsed' yang logis):
    - Tipe TANK (Golem, Troll, Knight): Lambat tapi keras. Gunakan 'agility' (untuk memutari mereka) atau 'intelligence' (mencari celah armor).
    - Tipe SPEED (Assassin, Kelelawar, Serigala): Cepat dan sudah kena. Gunakan 'agility' (adu cepat) atau 'intelligence' (prediksi gerak).
    - Tipe MAGIC/GHAIB (Wraith, Wizard, Elemental): Serangan non-fisik. Gunakan 'strength' (brute force interrupt) atau 'intelligence' (counter-spell).

    Penanganan Hasil Dadu & XP:
    - Jika VICTORY: Narasi kemenangan epik. Berikan XP (Tier 1: 20-30xp, Tier 2: 50-80xp, Tier 3: 150+xp) dan Loot.
    - Jika DEFEAT: Narasi kekalahan. Set 'is_game_over': true jika HP pemain 0.

    Format Output: JSON sesuai skema.
  `;

  try {
    let contents = history.map(h => h.text).join('\n');
    const currentPrompt = `Pemain memilih/Status: "${lastChoice}". Genre: ${genre}. Lanjutkan cerita.`;

    const response = await ai.models.generateContent({
      model: model,
      contents: [
        { role: 'user', parts: [{ text: systemInstruction }] },
        ...history.map(h => ({
            role: h.role,
            parts: [{ text: h.text }]
        })),
        { role: 'user', parts: [{ text: currentPrompt }] }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.8, 
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from AI");

    return JSON.parse(jsonText) as GameResponse;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      narrative: "Kabut tebal menghalangi pandangan takdir... (Error koneksi).",
      choices: [{ text: "Coba Lagi", isCritical: false }],
      visual_prompt_keyword: "fog",
      is_game_over: false,
      is_victory: false
    };
  }
};