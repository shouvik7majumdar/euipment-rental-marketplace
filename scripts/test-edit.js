const { Contract, SorobanRpc, TransactionBuilder, BASE_FEE, nativeToScVal, Address, Keypair } = require('@stellar/stellar-sdk');

const rpcUrl = 'https://soroban-testnet.stellar.org';
const contractId = 'CC4BAKPUE3L7S2FDGY7B3G7GWGRIZTWN5Q67R4REGEMNH7GMIQEWXVQE'; // New contract
const rpc = new SorobanRpc.Server(rpcUrl);
const networkPassphrase = "Test SDF Network ; September 2015";

async function main() {
  try {
    const owner = 'GDFEVTCEYZ6XFTU3I63RENM3FZIZT6ZAMXLNRA6TJRWXJIGJDIRMYLZ4'; // We'll just simulate as deployer

    const account = await rpc.getAccount(owner);
    const contract = new Contract(contractId);
    
    console.log('Building transaction...');
    const op = contract.call(
      'edit_equipment',
      new Address(owner).toScVal(),
      nativeToScVal(1, { type: 'u32' }),
      nativeToScVal('Test Title', { type: 'string' }),
      nativeToScVal(200n * 10000000n, { type: 'i128' }),
      nativeToScVal(500n * 10000000n, { type: 'i128' }),
    );

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    console.log('Simulating transaction...');
    const simResult = await rpc.simulateTransaction(tx);
    
    if (SorobanRpc.Api.isSimulationError(simResult)) {
        console.error('Simulation Error:', simResult.error);
    } else {
        console.log('Simulation Success! Result:', simResult);
    }
  } catch (err) {
    console.error('Caught error:', err);
  }
}

main();
