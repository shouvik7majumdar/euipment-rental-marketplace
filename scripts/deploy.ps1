# Deploy script for Stellar Soroban contract
# Make sure you have target/wasm32-unknown-unknown/release/stellar_rental_marketplace.wasm built.

$WasmPath = "C:\cargo-build\rental\wasm32-unknown-unknown\release\stellar_rental_marketplace.wasm"
$Network = "testnet"
$Source = "deployer"
$StellarCli = "c:\Users\user\OneDrive\Desktop\rise in\.bin\stellar.exe"

Write-Host "Checking if 'deployer' key exists..."
$Keys = & $StellarCli keys ls
if ($Keys -notcontains $Source) {
    Write-Host "Generating 'deployer' key..."
    & $StellarCli keys generate $Source --network $Network
}

$AdminAddress = & $StellarCli keys address $Source
Write-Host "Funding deployer address ($AdminAddress) via Friendbot..."
try {
    $Response = Invoke-RestMethod -Uri "https://friendbot.stellar.org/?addr=$AdminAddress"
    Write-Host "Account successfully funded!"
} catch {
    Write-Host "Funding warning: $_ (Account might already be funded)"
}

Write-Host "Deploying contract to Stellar $Network..."
$ContractId = & $StellarCli contract deploy --wasm $WasmPath --source $Source --network $Network

Write-Host "--------------------------------------------------"
Write-Host "Contract Deployed Successfully!"
Write-Host "Contract ID: $ContractId"
Write-Host "--------------------------------------------------"

# Native Token on Testnet is: CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
$NativeToken = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"

Write-Host "Initializing contract with admin: $AdminAddress and token: $NativeToken..."
& $StellarCli contract invoke --id $ContractId --source $Source --network $Network -- initialize --admin $AdminAddress --token $NativeToken

Write-Host "--------------------------------------------------"
Write-Host "Initialization Complete!"
Write-Host "Updating Next.js .env.local with: NEXT_PUBLIC_CONTRACT_ID=$ContractId"
Write-Host "--------------------------------------------------"
