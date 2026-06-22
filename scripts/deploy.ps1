# Deploy script for Stellar Soroban contracts (Marketplace & Reputation)
$ReputationWasm = "c:\Users\user\OneDrive\Desktop\rise in\contracts\target\wasm32v1-none\release\stellar_rental_reputation.wasm"
$MarketplaceWasm = "c:\Users\user\OneDrive\Desktop\rise in\contracts\target\wasm32v1-none\release\stellar_rental_marketplace.wasm"
$Network = "testnet"
$Source = "deployer"
$StellarCli = "c:\Users\user\OneDrive\Desktop\rise in\.bin\stellar.exe"

# Make sure wasm files exist
if (-not (Test-Path $ReputationWasm) -or -not (Test-Path $MarketplaceWasm)) {
    Write-Host "Building contracts..."
    $env:Path += ";C:\Users\user\.cargo\bin"
    cargo build --target wasm32-unknown-unknown --release --manifest-path "c:\Users\user\OneDrive\Desktop\rise in\contracts\Cargo.toml"
}

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

Write-Host "Deploying Reputation Contract..."
$ReputationId = & $StellarCli contract deploy --wasm $ReputationWasm --source $Source --network $Network
Write-Host "Reputation Contract ID: $ReputationId"

Write-Host "Deploying Marketplace Contract..."
$MarketplaceId = & $StellarCli contract deploy --wasm $MarketplaceWasm --source $Source --network $Network
Write-Host "Marketplace Contract ID: $MarketplaceId"

Write-Host "Initializing Reputation Contract..."
& $StellarCli contract invoke --id $ReputationId --source $Source --network $Network -- initialize --admin $AdminAddress --marketplace $MarketplaceId

# Native Token on Testnet
$NativeToken = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"

Write-Host "Initializing Marketplace Contract..."
& $StellarCli contract invoke --id $MarketplaceId --source $Source --network $Network -- initialize --admin $AdminAddress --token $NativeToken --reputation_contract $ReputationId

Write-Host "--------------------------------------------------"
Write-Host "Deployment and Initialization Complete!"
Write-Host "Reputation ID: $ReputationId"
Write-Host "Marketplace ID: $MarketplaceId"
Write-Host "--------------------------------------------------"

# Automatically write to env
$EnvFile = "c:\Users\user\OneDrive\Desktop\rise in\.env.local"
if (Test-Path $EnvFile) {
    $Content = Get-Content $EnvFile
    $NewContent = @()
    $HasRep = $false
    foreach ($Line in $Content) {
        if ($Line -like "NEXT_PUBLIC_CONTRACT_ID=*") {
            $NewContent += "NEXT_PUBLIC_CONTRACT_ID=$MarketplaceId"
        } elseif ($Line -like "NEXT_PUBLIC_REPUTATION_CONTRACT_ID=*") {
            $NewContent += "NEXT_PUBLIC_REPUTATION_CONTRACT_ID=$ReputationId"
            $HasRep = $true
        } else {
            $NewContent += $Line
        }
    }
    if (-not $HasRep) {
        $NewContent += "NEXT_PUBLIC_REPUTATION_CONTRACT_ID=$ReputationId"
    }
    $NewContent | Set-Content $EnvFile
    Write-Host "Updated .env.local with new contract IDs!"
} else {
    Write-Host "Warning: .env.local not found at $EnvFile"
}
