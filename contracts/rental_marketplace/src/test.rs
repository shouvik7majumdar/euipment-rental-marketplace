#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _},
    token::{StellarAssetClient, Client as TokenClient},
    Address, Env, String,
};

#[test]
fn test_rental_flow_refund() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let renter = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_address = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let token_client = TokenClient::new(&env, &token_address);
    let token_admin_client = StellarAssetClient::new(&env, &token_address);

    // Deploy contract
    let contract_id = env.register(RentalMarketplaceContract, ());
    let client = RentalMarketplaceContractClient::new(&env, &contract_id);

    // Initialize
    client.initialize(&admin, &token_address);

    // Mint tokens to renter
    token_admin_client.mint(&renter, &1000i128);
    assert_eq!(token_client.balance(&renter), 1000i128);

    // List equipment
    let title = String::from_str(&env, "Heavy Duty Drill");
    let daily_price = 15i128;
    let deposit = 100i128;

    let listing_id = client.list_equipment(&owner, &title, &daily_price, &deposit);
    assert_eq!(listing_id, 1);
    assert_eq!(client.get_total_listings(), 1);

    // Rent equipment for 4 days
    // cost = 15 * 4 + 100 = 160
    client.rent_equipment(&renter, &1, &4);

    // Verify escrow balances
    assert_eq!(token_client.balance(&renter), 840i128);
    assert_eq!(token_client.balance(&contract_id), 160i128);

    let listing = client.get_listing(&1).unwrap();
    assert_eq!(listing.is_available, false);
    assert_eq!(listing.current_renter, Some(renter.clone()));
    assert_eq!(listing.current_rental_payment, 60i128);

    // Return equipment, refund deposit
    client.return_equipment(&1, &true);

    // Verify final balances
    assert_eq!(token_client.balance(&renter), 940i128); // 840 + 100 refunded
    assert_eq!(token_client.balance(&owner), 60i128);   // Owner gets rental fee
    assert_eq!(token_client.balance(&contract_id), 0i128);

    let listing = client.get_listing(&1).unwrap();
    assert_eq!(listing.is_available, true);
    assert_eq!(listing.current_renter, None);
    assert_eq!(listing.current_rental_payment, 0i128);
}

#[test]
fn test_rental_flow_claim_deposit() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let renter = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_address = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let token_client = TokenClient::new(&env, &token_address);
    let token_admin_client = StellarAssetClient::new(&env, &token_address);

    let contract_id = env.register(RentalMarketplaceContract, ());
    let client = RentalMarketplaceContractClient::new(&env, &contract_id);

    client.initialize(&admin, &token_address);

    token_admin_client.mint(&renter, &1000i128);

    let title = String::from_str(&env, "Generator");
    let daily_price = 50i128;
    let deposit = 300i128;

    client.list_equipment(&owner, &title, &daily_price, &deposit);

    // Rent for 2 days. Cost = 50 * 2 + 300 = 400
    client.rent_equipment(&renter, &1, &2);

    // Return equipment, owner claims deposit (no refund)
    client.return_equipment(&1, &false);

    // Owner gets total rent + deposit = 100 + 300 = 400
    assert_eq!(token_client.balance(&renter), 600i128);
    assert_eq!(token_client.balance(&owner), 400i128);
    assert_eq!(token_client.balance(&contract_id), 0i128);
}

#[test]
fn test_administrative_controls() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_address = env.register_stellar_asset_contract_v2(token_admin.clone()).address();

    let contract_id = env.register(RentalMarketplaceContract, ());
    let client = RentalMarketplaceContractClient::new(&env, &contract_id);

    client.initialize(&admin, &token_address);

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
