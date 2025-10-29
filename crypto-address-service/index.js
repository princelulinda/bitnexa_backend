// crypto-address-service/index.js (or index.ts)
// This is a separate Node.js microservice that you need to set up and run.

const express = require('express')
const { Wallet, utils } = require('ethers')
const { InfuraProvider } = require('@ethersproject/providers')
require('dotenv').config() // For loading environment variables

const app = express()
app.use(express.json())

// --- Configuration ---
// IMPORTANT: Store your mnemonic securely. DO NOT hardcode it.
// Use environment variables, a secret manager, or a more robust key management solution.
const MNEMONIC = process.env.HD_WALLET_MNEMONIC
if (!MNEMONIC) {
  console.error('HD_WALLET_MNEMONIC is not set in environment variables.')
  process.exit(1)
}

// Infura Project ID (for ERC20/BEP20)
const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID
if (!INFURA_PROJECT_ID) {
  console.error('INFURA_PROJECT_ID is not set in environment variables.')
  // process.exit(1); // Allow to run without Infura if only TRC20 is needed
}

// TronGrid API Key (for TRC20)
const TRONGRID_API_KEY = process.env.TRONGRID_API_KEY
// Note: tronweb library is needed for TRC20, which is separate from ethers.js
// For simplicity in this example, we'll focus on EVM chains with ethers.js.
// Integrating tronweb would require additional setup.

// --- Providers ---
// Ethereum Mainnet Provider (for ERC20)
const ethProvider = INFURA_PROJECT_ID ? new InfuraProvider('mainnet', INFURA_PROJECT_ID) : null
// Binance Smart Chain Mainnet Provider (for BEP20)
// Infura doesn't directly support BSC, you'd use a custom RPC URL for BSC
const bscProvider = new InfuraProvider({ url: 'https://bsc-dataseed.binance.org/', name: 'bsc' }) // Example BSC provider

// --- Helper to derive address ---
function deriveAddress(mnemonic, path) {
  const wallet = Wallet.fromMnemonic(mnemonic, path)
  return wallet.address
}

// --- API Endpoint to Generate Address ---
app.post('/generate-address', (req, res) => {
  const { userId, currency, network } = req.body

  if (!userId || !currency || !network) {
    return res.status(400).json({ error: 'Missing userId, currency, or network.' })
  }

  let addressPath
  let derivedAddress

  try {
    switch (network) {
      case 'ERC20':
        // BIP44 path for Ethereum: m/44'/60'/0'/0/account_index
        // We can use userId as account_index for unique derivation
        addressPath = `m/44'/60'/0'/0/${userId}`
        derivedAddress = deriveAddress(MNEMONIC, addressPath)
        break
      case 'BEP20':
        // BEP20 uses the same address format and derivation as ERC20
        addressPath = `m/44'/60'/0'/0/${userId}`
        derivedAddress = deriveAddress(MNEMONIC, addressPath)
        break
      case 'TRC20':
        // TRC20 (Tron) uses a different address format and derivation.
        // This would require 'tronweb' library and specific Tron derivation logic.
        // For this example, we'll simulate a Tron address.
        // In a real app, you'd use tronweb.
        derivedAddress = `T${utils.sha256(utils.toUtf8Bytes(`${MNEMONIC}-${userId}-TRC20`)).substring(2, 36)}`
        break
      default:
        return res.status(400).json({ error: 'Unsupported network.' })
    }

    res.json({
      userId,
      currency,
      network,
      address: derivedAddress,
    })
  } catch (error) {
    console.error('Error generating address:', error)
    res.status(500).json({ error: 'Failed to generate address.' })
  }
})

// --- Start the server ---
const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Crypto Address Service running on port ${PORT}`)
})

// --- Dependencies for this microservice (package.json) ---
// {
//   "name": "crypto-address-service",
//   "version": "1.0.0",
//   "description": "Microservice for generating crypto deposit addresses",
//   "main": "index.js",
//   "scripts": {
//     "start": "node index.js"
//   },
//   "dependencies": {
//     "@ethersproject/providers": "^5.7.2",
//     "dotenv": "^16.4.5",
//     "ethers": "^5.7.2",
//     "express": "^4.19.2"
//     // "tronweb": "^4.1.0" // If you need TRC20, install this
//   }
// }
