# RentChain — Stellar Equipment Rental Marketplace

RentChain is a decentralized equipment rental marketplace built on Stellar using Soroban smart contracts. It features a Next.js 15 frontend, multi-wallet integration (Freighter, Lobstr, xBull, Hana), real-time on-chain events stream, and transaction logging.

## 🚀 Live Testnet Deployment

The smart contract is actively deployed and verified on the Stellar Testnet. You can view the contract state, balances, and all recent events or transactions directly on the block explorer:

* **Contract ID**: `CDF3GPIFEK632QGYMAWQX5BINMEGJSKR7GL3EISXNTZPLLKFQ4DMNAKQ`
* **Explorer Link**: [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CDF3GPIFEK632QGYMAWQX5BINMEGJSKR7GL3EISXNTZPLLKFQ4DMNAKQ)

---

## 📸 Platform Screenshots

### Landing Page
![Landing Page](public/landing.png)

### Marketplace
![Marketplace Dashboard](public/market.png)

### Smart Contract Integration
![Smart Contract Code](public/smart-contract.png)

---

## 💻 Technical Stack

* **Smart Contract:** Rust, Soroban SDK (v22.x)
* **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS
* **Wallet Integration:** StellarWalletsKit ( Freighter, LOBSTR, xBull, Hana)
* **State Management:** Zustand, TanStack React Query (v5)
* **Network:** Stellar Testnet

---

## 🛠️ Getting Started

### 1. Build and Test the Smart Contract
Tests run outside OneDrive (`C:\cargo-build\rental`) to avoid file lock issues during active compilation.
```bash
# Navigate to contract directory
cd contracts/rental_marketplace

# Run tests
$env:CARGO_TARGET_DIR = "C:\cargo-build\rental"; cargo test

# Build target WASM
$env:CARGO_TARGET_DIR = "C:\cargo-build\rental"; cargo build --target wasm32-unknown-unknown --release
```

### 2. Deploy to Stellar Testnet
Make sure you have `stellar-cli` installed. The deploy script handles deploying the contract, key generation, and smart contract initialization:
```powershell
# Execute the Powershell deployment script
./scripts/deploy.ps1
```
Note down the resulting `Contract ID`.

### 3. Setup Next.js Frontend
Create a `.env.local` file in the root workspace:
```env
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_CONTRACT_ID=<YOUR_DEPLOYED_CONTRACT_ID>
NEXT_PUBLIC_TOKEN_CONTRACT_ID=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

### 4. Install Dependencies & Run Frontend
```bash
# Install node packages
npm install

# Start local Next.js dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 📝 Contract Interface

The Soroban smart contract implements the following endpoints:
* `initialize(admin: Address, token: Address)`: Configure admin and native/custom payment token contract.
* `list_equipment(owner: Address, title: String, daily_price: i128, deposit: i128) -> u32`: List equipment for lease. Returns Listing ID.
* `rent_equipment(renter: Address, listing_id: u32, days: u32)`: Rent equipment by transferring rent fee + deposit into contract escrow.
* `initiate_return(renter: Address, listing_id: u32)`: Renter marks the equipment as ready for return.
* `confirm_return(owner: Address, listing_id: u32, refund_deposit: bool)`: Owner triggers return. Escrow releases daily rent to owner, and either refunds deposit to renter or releases deposit to owner (claim scenario).
* `get_listing(id: u32) -> Option<EquipmentListing>`: Read listing details.
* `get_total_listings() -> u32`: Read total number of listings.
