#![cfg(test)]

use super::*;
use stellar_rental_reputation::{RentalReputationContract, RentalReputationContractClient};
use soroban_sdk::{
    testutils::{Address as _},
    token::{StellarAssetClient, Client as TokenClient},
    Address, Env, String,
};

#[test]
fn test_rental_flow_with_reputation() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let renter = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_address = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let token_client = TokenClient::new(&env, &token_address);
    let token_admin_client = StellarAssetClient::new(&env, &token_address);

    // Deploy Reputation Contract
    let reputation_id = env.register(RentalReputationContract, ());
    let reputation_client = RentalReputationContractClient::new(&env, &reputation_id);

    // Deploy Marketplace Contract
    let marketplace_id = env.register(RentalMarketplaceContract, ());
    let marketplace_client = RentalMarketplaceContractClient::new(&env, &marketplace_id);

    // Initialize both
    reputation_client.initialize(&admin, &marketplace_id);
    marketplace_client.initialize(&admin, &token_address, &reputation_id);

    // Mint tokens to renter
    token_admin_client.mint(&renter, &1000i128);
    assert_eq!(token_client.balance(&renter), 1000i128);

    // Check initial reputation score (default = 100)
    assert_eq!(reputation_client.get_reputation(&renter), 100);
    assert_eq!(reputation_client.get_reputation(&owner), 100);

    // List equipment
    let title = String::from_str(&env, "Heavy Duty Drill");
    let daily_price = 15i128;
    let deposit = 100i128;

    let listing_id = marketplace_client.list_equipment(&owner, &title, &daily_price, &deposit);
    assert_eq!(listing_id, 1);

    // Rent equipment for 4 days
    marketplace_client.rent_equipment(&renter, &1, &4);

    // Verify escrow balances
    assert_eq!(token_client.balance(&renter), 840i128);
    assert_eq!(token_client.balance(&marketplace_id), 160i128);

    // Return equipment, refund deposit
    marketplace_client.return_equipment(&1, &true);

    // Verify final balances
    assert_eq!(token_client.balance(&renter), 940i128); // 840 + 100 refunded
    assert_eq!(token_client.balance(&owner), 60i128);   // Owner gets rental fee

    // Verify reputation scores increased
    assert_eq!(reputation_client.get_reputation(&renter), 110);
    assert_eq!(reputation_client.get_reputation(&owner), 110);
}

#[test]
fn test_rental_flow_claim_deposit_penalizes_renter() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let renter = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_address = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let token_admin_client = StellarAssetClient::new(&env, &token_address);

    // Deploy Reputation Contract
    let reputation_id = env.register(RentalReputationContract, ());
    let reputation_client = RentalReputationContractClient::new(&env, &reputation_id);

    // Deploy Marketplace Contract
    let marketplace_id = env.register(RentalMarketplaceContract, ());
    let marketplace_client = RentalMarketplaceContractClient::new(&env, &marketplace_id);

    // Initialize both
    reputation_client.initialize(&admin, &marketplace_id);
    marketplace_client.initialize(&admin, &token_address, &reputation_id);

    token_admin_client.mint(&renter, &1000i128);

    let title = String::from_str(&env, "Generator");
    marketplace_client.list_equipment(&owner, &title, &50i128, &300i128);

    // Rent for 2 days. Cost = 50 * 2 + 300 = 400
    marketplace_client.rent_equipment(&renter, &1, &2);

    // Return equipment, owner claims deposit (no refund)
    marketplace_client.return_equipment(&1, &false);

    // Verify reputation penalty (-20 score)
    assert_eq!(reputation_client.get_reputation(&renter), 80);
}

#[test]
#[should_panic(expected = "Renter is blacklisted")]
fn test_blacklist_prevents_renting() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let renter = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_address = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let token_admin_client = StellarAssetClient::new(&env, &token_address);

    // Deploy Reputation Contract
    let reputation_id = env.register(RentalReputationContract, ());
    let reputation_client = RentalReputationContractClient::new(&env, &reputation_id);

    // Deploy Marketplace Contract
    let marketplace_id = env.register(RentalMarketplaceContract, ());
    let marketplace_client = RentalMarketplaceContractClient::new(&env, &marketplace_id);

    // Initialize both
    reputation_client.initialize(&admin, &marketplace_id);
    marketplace_client.initialize(&admin, &token_address, &reputation_id);

    token_admin_client.mint(&renter, &1000i128);

    let title = String::from_str(&env, "Generator");
    marketplace_client.list_equipment(&owner, &title, &50i128, &300i128);

    // Blacklist the renter
    reputation_client.set_blacklisted(&admin, &renter, &true);
    assert_eq!(reputation_client.is_blacklisted(&renter), true);

    // Try to rent — should panic
    marketplace_client.rent_equipment(&renter, &1, &2);
}

#[test]
#[should_panic]
fn test_reputation_unauthorized_calls_fail() {
    let env = Env::default();
    // Do NOT mock_all_auths to verify require_auth failure
    let admin = Address::generate(&env);
    let renter = Address::generate(&env);
    let marketplace_id = Address::generate(&env);

    // Deploy Reputation Contract
    let reputation_id = env.register(RentalReputationContract, ());
    let reputation_client = RentalReputationContractClient::new(&env, &reputation_id);

    // Initialize reputation with marketplace_id
    reputation_client.initialize(&admin, &marketplace_id);

    // Try to call add_reputation directly — should panic since caller is not authorized
    reputation_client.add_reputation(&renter, &10);
}

#[test]
fn test_administrative_controls() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let reputation_id = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_address = env.register_stellar_asset_contract_v2(token_admin.clone()).address();

    let contract_id = env.register(RentalMarketplaceContract, ());
    let client = RentalMarketplaceContractClient::new(&env, &contract_id);

    client.initialize(&admin, &token_address, &reputation_id);

    let title = String::from_str(&env, "Generator");
    client.list_equipment(&owner, &title, &50i128, &300i128);

    // Edit Equipment
    let new_title = String::from_str(&env, "Generator V2");
    client.edit_equipment(&owner, &1, &new_title, &60i128, &350i128);
    
    let listing = client.get_listing(&1).unwrap();
    assert_eq!(listing.title, new_title);
    assert_eq!(listing.daily_price, 60i128);
    assert_eq!(listing.deposit, 350i128);

    // Mark Unavailable
    client.mark_unavailable(&owner, &1);
    let listing = client.get_listing(&1).unwrap();
    assert_eq!(listing.is_available, false);

    // Mark Available
    client.mark_available(&owner, &1);
    let listing = client.get_listing(&1).unwrap();
    assert_eq!(listing.is_available, true);

    // Delete Equipment
    client.delete_equipment(&owner, &1);
    assert!(client.get_listing(&1).is_none());
}
