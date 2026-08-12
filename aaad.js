import bip39 from "bip39"

async function main() {
    const mnemonic = bip39.generateMnemonic(128);

    console.log("Mnemonic:", mnemonic);

    const seed = await bip39.mnemonicToSeed(mnemonic);

    console.log("Seed:", seed.toString("hex"));
}

main();