#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String, token, BytesN
};

const DAY_IN_SECONDS: u64 = 86400;
const TTL_INSTANCE: u32 = 17280 * 30; // ~30 days in ledgers
const TTL_PERSISTENT: u32 = 17280 * 30; // ~30 days in ledgers

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
    pub return_initiated: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Token,
    ListingCount,
    ActiveListingCount,
    Listing(u32),
}

fn extend_instance_ttl(env: &Env) {
    env.storage().instance().extend_ttl(TTL_INSTANCE, TTL_INSTANCE);
}

fn extend_persistent_ttl(env: &Env, key: &DataKey) {
    env.storage().persistent().extend_ttl(key, TTL_PERSISTENT, TTL_PERSISTENT);
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
        env.storage().instance().set(&DataKey::ActiveListingCount, &0u32);
        extend_instance_ttl(&env);
    }

    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    pub fn get_token(env: Env) -> Address {
        extend_instance_ttl(&env);
        env.storage().instance().get(&DataKey::Token).unwrap()
    }

    pub fn get_admin(env: Env) -> Address {
        extend_instance_ttl(&env);
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
        extend_instance_ttl(&env);

        if daily_price <= 0 {
            panic!("Daily price must be positive");
        }
        if deposit < 0 {
            panic!("Deposit cannot be negative");
        }

        let mut count: u32 = env.storage().instance().get(&DataKey::ListingCount).unwrap_or(0);
        count += 1;

        let mut active_count: u32 = env.storage().instance().get(&DataKey::ActiveListingCount).unwrap_or(0);
        active_count += 1;

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
            return_initiated: false,
        };

        let key = DataKey::Listing(count);
        env.storage().persistent().set(&key, &listing);
        extend_persistent_ttl(&env, &key);
        
        env.storage().instance().set(&DataKey::ListingCount, &count);
        env.storage().instance().set(&DataKey::ActiveListingCount, &active_count);

        env.events().publish(
            (symbol_short!("listed"), count, owner.clone()),
            (title, daily_price, deposit),
        );

        count
    }

    pub fn get_listing(env: Env, id: u32) -> Option<EquipmentListing> {
        let key = DataKey::Listing(id);
        let listing = env.storage().persistent().get(&key);
        if listing.is_some() {
            extend_persistent_ttl(&env, &key);
        }
        listing
    }

    pub fn get_total_listings(env: Env) -> u32 {
        extend_instance_ttl(&env);
        env.storage().instance().get(&DataKey::ActiveListingCount).unwrap_or(0)
    }

    pub fn rent_equipment(env: Env, renter: Address, id: u32, days: u32) {
        renter.require_auth();
        extend_instance_ttl(&env);

        let key = DataKey::Listing(id);
        let mut listing: EquipmentListing = env
            .storage()
            .persistent()
            .get(&key)
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
        listing.rental_expires_at = current_time + (days as u64 * DAY_IN_SECONDS);
        listing.current_rental_payment = rental_payment;
        listing.return_initiated = false;

        env.storage().persistent().set(&key, &listing);
        extend_persistent_ttl(&env, &key);

        env.events().publish(
            (symbol_short!("rented"), id, renter.clone()),
            (days, daily_price, deposit),
        );
    }

    pub fn initiate_return(env: Env, renter: Address, id: u32) {
        renter.require_auth();
        extend_instance_ttl(&env);
        
        let key = DataKey::Listing(id);
        let mut listing: EquipmentListing = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("Listing not found"));

        if listing.is_available {
            panic!("Equipment is not currently rented");
        }
        if listing.current_renter != Some(renter.clone()) {
            panic!("Only the current renter can initiate a return");
        }
        if listing.return_initiated {
            panic!("Return already initiated");
        }

        listing.return_initiated = true;
        
        env.storage().persistent().set(&key, &listing);
        extend_persistent_ttl(&env, &key);

        env.events().publish((symbol_short!("ret_init"), id), renter);
    }

    pub fn confirm_return(env: Env, owner: Address, id: u32, refund_deposit: bool) {
        owner.require_auth();
        extend_instance_ttl(&env);
        
        let key = DataKey::Listing(id);
        let mut listing: EquipmentListing = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("Listing not found"));

        if listing.is_available {
            panic!("Equipment is not currently rented");
        }
        if listing.owner != owner {
            panic!("Not owner");
        }

        let current_time = env.ledger().timestamp();
        
        // Owner can only confirm return if the renter initiated it, 
        // OR if the rental period has officially expired.
        if !listing.return_initiated && current_time < listing.rental_expires_at {
            panic!("Rental has not expired and renter has not initiated return");
        }

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
        listing.return_initiated = false;

        env.storage().persistent().set(&key, &listing);
        extend_persistent_ttl(&env, &key);

        env.events().publish(
            (symbol_short!("returned"), id, listing.owner.clone()),
            (refund_deposit, renter),
        );
    }

    pub fn edit_equipment(
        env: Env,
        owner: Address,
        id: u32,
        title: String,
        daily_price: i128,
        deposit: i128,
    ) {
        owner.require_auth();
        extend_instance_ttl(&env);
        
        let key = DataKey::Listing(id);
        let mut listing: EquipmentListing = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("Listing not found"));

        if listing.owner != owner {
            panic!("Not owner");
        }
        if !listing.is_available {
            panic!("Cannot edit equipment while unavailable or rented");
        }
        if daily_price <= 0 {
            panic!("Daily price must be positive");
        }
        if deposit < 0 {
            panic!("Deposit cannot be negative");
        }

        listing.title = title;
        listing.daily_price = daily_price;
        listing.deposit = deposit;

        env.storage().persistent().set(&key, &listing);
        extend_persistent_ttl(&env, &key);
        
        env.events().publish((symbol_short!("edited"), id, owner), (daily_price, deposit));
    }

    pub fn delete_equipment(env: Env, owner: Address, id: u32) {
        owner.require_auth();
        extend_instance_ttl(&env);
        
        let key = DataKey::Listing(id);
        let listing: EquipmentListing = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("Listing not found"));

        if listing.owner != owner {
            panic!("Not owner");
        }
        if !listing.is_available && listing.current_renter.is_some() {
            panic!("Cannot delete currently rented equipment");
        }

        env.storage().persistent().remove(&key);
        
        let mut active_count: u32 = env.storage().instance().get(&DataKey::ActiveListingCount).unwrap_or(0);
        if active_count > 0 {
            active_count -= 1;
            env.storage().instance().set(&DataKey::ActiveListingCount, &active_count);
        }

        env.events().publish((symbol_short!("deleted"), id), owner);
    }

    pub fn mark_unavailable(env: Env, owner: Address, id: u32) {
        owner.require_auth();
        extend_instance_ttl(&env);
        
        let key = DataKey::Listing(id);
        let mut listing: EquipmentListing = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("Listing not found"));

        if listing.owner != owner {
            panic!("Not owner");
        }
        if !listing.is_available {
            panic!("Equipment is already unavailable");
        }

        listing.is_available = false;
        env.storage().persistent().set(&key, &listing);
        extend_persistent_ttl(&env, &key);
        
        env.events().publish((symbol_short!("unavail"), id), owner);
    }

    pub fn mark_available(env: Env, owner: Address, id: u32) {
        owner.require_auth();
        extend_instance_ttl(&env);
        
        let key = DataKey::Listing(id);
        let mut listing: EquipmentListing = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("Listing not found"));

        if listing.owner != owner {
            panic!("Not owner");
        }
        if listing.is_available {
            panic!("Equipment is already available");
        }
        if listing.current_renter.is_some() {
            panic!("Cannot mark available while rented on-chain");
        }

        listing.is_available = true;
        env.storage().persistent().set(&key, &listing);
        extend_persistent_ttl(&env, &key);
        
        env.events().publish((symbol_short!("avail"), id), owner);
    }
}
