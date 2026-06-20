#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String, token
};

#[cfg(test)]
mod test;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EquipmentListing {
    pub id: u32,
    pub owner: Address,
    pub title: String,
    pub daily_price: i128,
    pub deposit: i128,
    pub is_available: bool,
    pub current_renter: Option<Address>,
    pub rental_expires_at: u64,
    pub current_rental_payment: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Token,
    ListingCount,
    Listing(u32),
}

#[contract]
pub struct RentalMarketplaceContract;

#[contractimpl]
impl RentalMarketplaceContract {
    pub fn initialize(env: Env, admin: Address, token: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::ListingCount, &0u32);
    }

    pub fn get_token(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Token).unwrap()
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn list_equipment(
        env: Env,
        owner: Address,
        title: String,
        daily_price: i128,
        deposit: i128,
    ) -> u32 {
        owner.require_auth();

        if daily_price <= 0 {
            panic!("Daily price must be positive");
        }
        if deposit < 0 {
            panic!("Deposit cannot be negative");
        }

        let mut count: u32 = env.storage().instance().get(&DataKey::ListingCount).unwrap_or(0);
        count += 1;

        let listing = EquipmentListing {
            id: count,
            owner: owner.clone(),
            title: title.clone(),
            daily_price,
            deposit,
            is_available: true,
            current_renter: None,
            rental_expires_at: 0,
            current_rental_payment: 0,
        };

        env.storage().persistent().set(&DataKey::Listing(count), &listing);
        env.storage().instance().set(&DataKey::ListingCount, &count);

        env.events().publish(
            (symbol_short!("listed"), count, owner.clone()),
            (title, daily_price, deposit),
        );

        count
    }

    pub fn get_listing(env: Env, id: u32) -> Option<EquipmentListing> {
        env.storage().persistent().get(&DataKey::Listing(id))
    }

    pub fn get_total_listings(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::ListingCount).unwrap_or(0)
    }

    pub fn rent_equipment(env: Env, renter: Address, id: u32, days: u32) {
        renter.require_auth();

        let mut listing: EquipmentListing = env
            .storage()
            .persistent()
            .get(&DataKey::Listing(id))
            .unwrap_or_else(|| panic!("Listing not found"));

        if !listing.is_available {
            panic!("Equipment is already rented");
        }
        if days == 0 {
            panic!("Rental duration must be at least 1 day");
        }

        let daily_price = listing.daily_price;
        let deposit = listing.deposit;
        let rental_payment = daily_price * days as i128;
        let total_cost = rental_payment + deposit;

        let token_addr = Self::get_token(env.clone());
        let token_client = token::Client::new(&env, &token_addr);

        // Escrow funds: Renter -> Contract
        token_client.transfer(&renter, &env.current_contract_address(), &total_cost);

        // Update listing
        let current_time = env.ledger().timestamp();
        listing.is_available = false;
        listing.current_renter = Some(renter.clone());
        listing.rental_expires_at = current_time + (days as u64 * 86400);
        listing.current_rental_payment = rental_payment;

        env.storage().persistent().set(&DataKey::Listing(id), &listing);

        env.events().publish(
            (symbol_short!("rented"), id, renter.clone()),
            (days, daily_price, deposit),
        );
    }

    pub fn return_equipment(env: Env, id: u32, refund_deposit: bool) {
        let mut listing: EquipmentListing = env
            .storage()
            .persistent()
            .get(&DataKey::Listing(id))
            .unwrap_or_else(|| panic!("Listing not found"));

        if listing.is_available {
            panic!("Equipment is not currently rented");
        }

        listing.owner.require_auth();

        let renter = listing.current_renter.clone().unwrap();
        let deposit = listing.deposit;
        let rental_payment = listing.current_rental_payment;

        let token_addr = Self::get_token(env.clone());
        let token_client = token::Client::new(&env, &token_addr);

        if refund_deposit {
            // Transfer rent to owner, deposit back to renter
            if rental_payment > 0 {
                token_client.transfer(&env.current_contract_address(), &listing.owner, &rental_payment);
            }
            if deposit > 0 {
                token_client.transfer(&env.current_contract_address(), &renter, &deposit);
            }
        } else {
            // Transfer full escrow (rent + deposit) to owner
            let total_payment = rental_payment + deposit;
            if total_payment > 0 {
                token_client.transfer(&env.current_contract_address(), &listing.owner, &total_payment);
            }
        }

        // Reset listing state
        listing.is_available = true;
        listing.current_renter = None;
        listing.rental_expires_at = 0;
        listing.current_rental_payment = 0;

        env.storage().persistent().set(&DataKey::Listing(id), &listing);

        env.events().publish(
            (symbol_short!("returned"), id, listing.owner.clone()),
            (refund_deposit, renter),
        );
    }
}
