import bip39 from "bip39";
import crypto from "crypto";

function generate12Words() {
  // 128 bits d'entropie = 12 mots
  const entropy = crypto.randomBytes(16); // 16 bytes = 128 bits
  const mnemonic = bip39.entropyToMnemonic(entropy.toString("hex"));
  return mnemonic;
}

console.log("Mnemonic 12 mots sécurisé :");
console.log(generate12Words());
