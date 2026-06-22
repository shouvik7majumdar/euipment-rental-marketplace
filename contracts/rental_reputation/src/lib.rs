#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Marketplace,
    Reputation(Address),
    Blacklist(Address),
}

#[contract]
pub struct RentalReputationContract;

#[contractimpl]
impl RentalReputationContract {
    pub fn initialize(env: Env, admin: Address, marketplace: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Marketplace, &marketplace);
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn get_marketplace(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Marketplace).unwrap()
    }

    pub fn add_reputation(env: Env, user: Address, points: i32) {
        let marketplace = Self::get_marketplace(env.clone());
        marketplace.require_auth();

        if points <= 0 {
            panic!("Points to add must be positive");
        }

        let mut current_score = Self::get_reputation(env.clone(), user.clone());
        current_score += points;

        env.storage().persistent().set(&DataKey::Reputation(user.clone()), &current_score);

        env.events().publish(
            (symbol_short!("rep_up"), user),
            (current_score, points),
        );
    }

    pub fn deduct_reputation(env: Env, user: Address, points: i32) {
        let marketplace = Self::get_marketplace(env.clone());
        marketplace.require_auth();

        if points <= 0 {
            panic!("Points to deduct must be positive");
        }

        let mut current_score = Self::get_reputation(env.clone(), user.clone());
        current_score -= points;
        if current_score < 0 {
            current_score = 0;
        }

        env.storage().persistent().set(&DataKey::Reputation(user.clone()), &current_score);

        env.events().publish(
            (symbol_short!("rep_down"), user),
            (current_score, points),
        );
    }

    pub fn set_blacklisted(env: Env, admin: Address, user: Address, status: bool) {
        admin.require_auth();
        let current_admin = Self::get_admin(env.clone());
        if admin != current_admin {
            panic!("Not admin");
        }

        env.storage().persistent().set(&DataKey::Blacklist(user.clone()), &status);

        env.events().publish(
            (symbol_short!("bl_update"), user),
            status,
        );
    }

    pub fn get_reputation(env: Env, user: Address) -> i32 {
        env.storage().persistent().get(&DataKey::Reputation(user)).unwrap_or(100)
    }

    pub fn is_blacklisted(env: Env, user: Address) -> bool {
        env.storage().persistent().get(&DataKey::Blacklist(user)).unwrap_or(false)
    }
}
