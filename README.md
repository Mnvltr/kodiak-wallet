# 🐻 Kodiak Wallet

Kodiak Wallet allows you to create transactions even without an internet connection. It is designed with an "Offline Mode" where transactions can be signed locally and queued up.

## Features

  - **Offline wallet management** - Create and manage accounts without a connection
  - **Connection with external wallets** - Compatible with Ready Wallet and Braavos
  - **Desktop application** - `.exe` executable for Windows
    **Web version** - Also kind of works in browsers
  - **Connection detection** - Real-time online/offline status indicator
  - **Security** - Locally signed transactions

## Quick Install

### Option 1: Desktop Executable (Discontinued)

1.  Go to [KodiakWallet.exe](https://drive.google.com/file/d/1Pn_jKbMEvOsu-QQXXBi4vntlvBzl-WsU/view?usp=sharing)
2.  Download `KodiakWallet-[version].exe`
3.  Run the installer
4.  Ready to use\!

### Option 2: From Source Code

#### Prerequisites

  - Node.js 18+
  - npm or yarn
  - Git

#### Installation Steps

```bash
# 1. Clone the repository
git clone https://github.com/your-username/kodiak-wallet.git
cd kodiak-wallet

# 2. Install dependencies
npm install

# 3. Run in development mode
npm run dev

# 4. (Optional) Build executable
npm run build-windows
```

## User Guide

### Connect with External Wallets

#### In the Web Version:

1.  [Kodiak Web]([https://kodiak-wallet.vercel.app/](https://kodiakwallet.vercel.app/))
2.  Make sure you have a compatible wallet installed:
      - [Ready Wallet](https://chromewebstore.google.com/detail/ready-wallet-formerly-arg/dlcobpjiigpikoobohmabehhmhfoodbb)
      - [Braavos](https://chromewebstore.google.com/detail/braavos-bitcoin-starknet/jnlgamecbpmbajjfhmmmlhejkemejdma)
3.  Click on **"Connect Wallet"**
4.  Select your preferred wallet
5.  Authorize the connection\!
*(Note: In the web version, the offline function is only available if the page is not reloaded)*.

#### In the Desktop Version (Discontinued):

1.  Open the Kodiak Wallet application
2.  Click on **"Connect Wallet"**
3.  A dialog will appear asking if you want to open it in the browser
4.  Click **"Yes"** - it will open automatically in your browser
5.  Connect with your wallet as described above

### For Developers

#### Available Commands

```bash
# Development
npm run dev           # Development server (port 5173)
npm run build         # Production build for web
npm run preview       # Preview the build

# Electron
npm run electron-dev    # Development with Electron
npm run build-electron  # Build web app + Electron
npm run build-windows   # Create .exe executable for Windows

# Utilities
npm run lint          # Lint code
npm run test          # Run tests
```

#### Project Structure

```
src/
├── App.jsx           # Main component
├── main.jsx          # React entry point
├── index.css         # Global styles
└── components/       # Reusable components

electron_main.cjs     # Electron main process
electron_preload.cjs  # Secure preload script
vite.config.js        # Vite configuration
package.json          # Dependencies and scripts
```

## Development Setup

### Environment Variables

```bash
# .env.local
VITE_STARKNET_NETWORK=sepolia
VITE_CONTRACT_ADDRESS=0x06dddc3d870b18006bf59b1b33e21a576aa79a7b34a739ba04f2699c3da25173
VITE_STRK_TOKEN_ADDRESS=0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
```

## Build for Distribution

### Create Executable for Windows (from Linux/WSL)

```bash
# 1. Install build dependencies
sudo apt update
sudo apt install wine

# 2. Configure Wine for 64-bit
export WINEARCH=win64
winecfg

# 3. Build the executable
npm run build-windows

# The executable will be in: dist/KodiakWallet-[version].exe
```

### Web Deploy (Vercel/Netlify)

```bash
# 1. Production build
npm run build

# 2. The contents of dist/ are ready to deploy
# Vercel: vercel --prod
# Netlify: netlify deploy --prod --dir=dist
```

## Security

  - **Private keys** never leave your device
  - **Transactions** are signed locally
  - **No telemetry** - your privacy is a priority

## Supported Networks

  - ✅ **Starknet Sepolia** (Testnet)
  - 🔄 **Starknet Mainnet** (Coming soon)

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](https://www.google.com/search?q=LICENSE) file for details.
