import bip39 from "bip39"

// Générer 12 mots (128 bits d'entropie)
const mnemonic = bip39.generateMnemonic(128);

console.log("Seed phrase :", mnemonic);